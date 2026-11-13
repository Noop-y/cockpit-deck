/*
 * The Deck — programme de l'écran (ESP32-P4-WIFI6-Touch-LCD-7B, 1024 × 600)
 *
 * Étape 2 « USB » : branché sur sa prise « USB », l'écran est reconnu par Windows comme clavier,
 * touches multimédia, manette et liaison série avec le logiciel, qui peut aussi y envoyer les mises à jour du programme. Écran de test : état de l'USB et du
 * logiciel, quatre boutons d'essai, et un point qui suit le doigt.
 *
 * Les textes sont sans accents pour l'instant : la police intégrée à LVGL ne les a pas.
 * Plus tard, les pages arriveront du logiciel sous forme d'images (voir docs/adr/0005).
 */
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_app_desc.h"
#include "lvgl.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "class/hid/hid.h"
#include "usb_deck.h"

static const char *TAG = "the-deck";

// couleurs de l'apparence « Cockpit » du logiciel
#define COL_FOND   0x07090C
#define COL_CASE   0x111820
#define COL_BORD   0x26303A
#define COL_AMBRE  0xFFB547
#define COL_TEXTE  0xE8EDF2
#define COL_GRIS   0x7D8A97
#define COL_VERT   0x3FB97A

static lv_obj_t *s_usb;        // « USB : … »
static lv_obj_t *s_app;        // « Logiciel : … »
static lv_obj_t *s_point;      // point qui suit le doigt
static lv_obj_t *s_coord;      // dernier essai / coordonnées

// les quatre boutons d'essai
typedef enum { ESSAI_TEXTE, ESSAI_VOLUME, ESSAI_MANETTE, ESSAI_F13 } essai_t;
static const char *ESSAI_NOM[] = { "Ecrire deck", "Volume +", "Manette : bouton 1", "Touche F13" };
static const char *ESSAI_AIDE[] = {
    "Ouvre le Bloc-notes : le mot deck s'ecrit",
    "Le volume de Windows monte",
    "Windows : joy.cpl > Proprietes : le bouton 1 s'allume",
    "Touche reservee aux cases du logiciel (invisible)",
};

static void essai_cb(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t *btn = lv_event_get_target(e);
    essai_t k = (essai_t)(intptr_t)lv_event_get_user_data(e);
    bool down = (code == LV_EVENT_PRESSED);
    if (code != LV_EVENT_PRESSED && code != LV_EVENT_RELEASED && code != LV_EVENT_PRESS_LOST) return;
    lv_obj_set_style_bg_color(btn, lv_color_hex(down ? COL_AMBRE : COL_CASE), 0);
    lv_obj_set_style_text_color(btn, lv_color_hex(down ? COL_FOND : COL_TEXTE), 0);
    switch (k) {
    case ESSAI_TEXTE:   if (down) usb_deck_type("deck"); break;
    case ESSAI_VOLUME:  usb_deck_media(HID_USAGE_CONSUMER_VOLUME_INCREMENT, down); break;
    case ESSAI_MANETTE: usb_deck_pad(1, down); break;
    case ESSAI_F13:     usb_deck_key(HID_KEY_F13, down); break;
    }
    if (down) lv_label_set_text_fmt(s_coord, "%s : %s", ESSAI_NOM[k], ESSAI_AIDE[k]);
}

// le point suit le doigt partout sur l'écran : on vérifie que le tactile tombe au bon endroit
static void ecran_cb(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_indev_t *indev = lv_indev_active();
    if (indev == NULL) return;
    if (code == LV_EVENT_PRESSED || code == LV_EVENT_PRESSING) {
        lv_point_t p;
        lv_indev_get_point(indev, &p);
        lv_obj_set_pos(s_point, p.x - 12, p.y - 12);
        lv_obj_remove_flag(s_point, LV_OBJ_FLAG_HIDDEN);
        lv_label_set_text_fmt(s_coord, "Doigt : x %d   y %d", (int)p.x, (int)p.y);
    } else if (code == LV_EVENT_RELEASED || code == LV_EVENT_PRESS_LOST) {
        lv_obj_add_flag(s_point, LV_OBJ_FLAG_HIDDEN);
    }
}

static lv_obj_t *texte(lv_obj_t *parent, const char *txt, const lv_font_t *font, uint32_t couleur)
{
    lv_obj_t *l = lv_label_create(parent);
    lv_label_set_text(l, txt);
    lv_obj_set_style_text_font(l, font, 0);
    lv_obj_set_style_text_color(l, lv_color_hex(couleur), 0);
    return l;
}

// état de l'USB et du logiciel, mis à jour deux fois par seconde
static void etat_timer(lv_timer_t *t)
{
    (void)t;
    int pct = usb_deck_update_pct();
    if (pct >= 0) {   // mise à jour du programme par le câble en cours
        lv_label_set_text_fmt(s_usb, "Mise a jour du programme : %d %%", pct);
        lv_obj_set_style_text_color(s_usb, lv_color_hex(COL_AMBRE), 0);
        lv_label_set_text(s_app, pct >= 100 ? "Redemarrage..." : "Ne pas debrancher");
        lv_obj_set_style_text_color(s_app, lv_color_hex(COL_AMBRE), 0);
        return;
    }
    bool usb = usb_deck_mounted();
    lv_label_set_text(s_usb, usb ? "USB : reconnu par le PC (clavier + manette)" : "USB : pas relie (prise USB du milieu)");
    lv_obj_set_style_text_color(s_usb, lv_color_hex(usb ? COL_VERT : COL_GRIS), 0);
    if (usb_deck_app_linked()) {
        lv_label_set_text_fmt(s_app, "Logiciel The Deck : relie (version %s)", usb_deck_app_version());
        lv_obj_set_style_text_color(s_app, lv_color_hex(COL_VERT), 0);
    } else {
        lv_label_set_text(s_app, "Logiciel The Deck : pas relie");
        lv_obj_set_style_text_color(s_app, lv_color_hex(COL_GRIS), 0);
    }
}

static void ecran_test(void)
{
    lv_obj_t *scr = lv_screen_active();
    lv_obj_clean(scr);
    lv_obj_set_style_bg_color(scr, lv_color_hex(COL_FOND), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_event_cb(scr, ecran_cb, LV_EVENT_ALL, NULL);

    lv_obj_t *cadre = lv_obj_create(scr);
    lv_obj_set_size(cadre, 1024 - 40, 600 - 40);
    lv_obj_center(cadre);
    lv_obj_set_style_bg_opa(cadre, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_color(cadre, lv_color_hex(COL_BORD), 0);
    lv_obj_set_style_border_width(cadre, 2, 0);
    lv_obj_set_style_radius(cadre, 18, 0);
    lv_obj_remove_flag(cadre, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *titre = texte(scr, "THE DECK", &lv_font_montserrat_48, COL_AMBRE);
    lv_obj_set_style_text_letter_space(titre, 8, 0);
    lv_obj_align(titre, LV_ALIGN_TOP_MID, 0, 50);

    char ligne[64];
    snprintf(ligne, sizeof ligne, "Programme de l'ecran - version %s", esp_app_get_description()->version);
    lv_obj_t *ver = texte(scr, ligne, &lv_font_montserrat_24, COL_GRIS);
    lv_obj_align(ver, LV_ALIGN_TOP_MID, 0, 115);

    s_usb = texte(scr, "", &lv_font_montserrat_24, COL_GRIS);
    lv_obj_align(s_usb, LV_ALIGN_TOP_MID, 0, 165);
    s_app = texte(scr, "", &lv_font_montserrat_24, COL_GRIS);
    lv_obj_align(s_app, LV_ALIGN_TOP_MID, 0, 200);

    // quatre boutons d'essai, dans le style des cases du logiciel
    for (int i = 0; i < 4; i++) {
        lv_obj_t *btn = lv_button_create(scr);
        lv_obj_set_size(btn, 210, 130);
        lv_obj_align(btn, LV_ALIGN_TOP_LEFT, 52 + i * 232, 265);
        lv_obj_set_style_bg_color(btn, lv_color_hex(COL_CASE), 0);
        lv_obj_set_style_border_color(btn, lv_color_hex(COL_AMBRE), 0);
        lv_obj_set_style_border_width(btn, 3, 0);
        lv_obj_set_style_radius(btn, 18, 0);
        lv_obj_set_style_shadow_width(btn, 0, 0);
        lv_obj_set_style_text_color(btn, lv_color_hex(COL_TEXTE), 0);
        lv_obj_add_event_cb(btn, essai_cb, LV_EVENT_ALL, (void *)(intptr_t)i);
        lv_obj_t *l = texte(btn, ESSAI_NOM[i], &lv_font_montserrat_24, COL_TEXTE);
        lv_obj_set_style_text_color(l, lv_color_hex(COL_TEXTE), 0);
        lv_obj_set_width(l, 190);
        lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
        lv_obj_center(l);
    }

    s_coord = texte(scr, "Touche un bouton, ou pose le doigt n'importe ou", &lv_font_montserrat_16, COL_GRIS);
    lv_obj_align(s_coord, LV_ALIGN_BOTTOM_MID, 0, -75);

    s_point = lv_obj_create(scr);
    lv_obj_set_size(s_point, 24, 24);
    lv_obj_set_style_radius(s_point, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(s_point, lv_color_hex(COL_AMBRE), 0);
    lv_obj_set_style_border_width(s_point, 0, 0);
    lv_obj_remove_flag(s_point, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_point, LV_OBJ_FLAG_HIDDEN | LV_OBJ_FLAG_IGNORE_LAYOUT);

    etat_timer(NULL);
    lv_timer_create(etat_timer, 500, NULL);
}

void app_main(void)
{
    ESP_LOGI(TAG, "The Deck, programme de l'ecran %s", esp_app_get_description()->version);

    // affichage + tactile. Image retournée (180°) : dans le boîtier, les prises de la carte sont à gauche vu de face.
    // Le tactile suit (réglages Espressif pour un écran MIPI-DSI : 0° = miroir x et y, 180° = sans miroir).
    bsp_display_cfg_t cfg = {
        .lv_adapter_cfg = ESP_LV_ADAPTER_DEFAULT_CONFIG(),
        .rotation = ESP_LV_ADAPTER_ROTATE_180,
        .tear_avoid_mode = ESP_LV_ADAPTER_TEAR_AVOID_MODE_TRIPLE_PARTIAL,
        .touch_flags = {
            .swap_xy = 0,
            .mirror_x = 0,
            .mirror_y = 0,
        },
    };
    lv_display_t *display = bsp_display_start_with_config(&cfg);
    ESP_ERROR_CHECK(display != NULL ? ESP_OK : ESP_FAIL);
    bsp_display_backlight_on();

    // USB : clavier + touches multimédia + manette + liaison avec le logiciel
    usb_deck_start();

    ESP_ERROR_CHECK(bsp_display_lock(-1) ? ESP_OK : ESP_ERR_TIMEOUT);
    ecran_test();
    bsp_display_unlock();
}
