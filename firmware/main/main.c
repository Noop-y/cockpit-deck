/*
 * The Deck — programme de l'écran (ESP32-P4-WIFI6-Touch-LCD-7B, 1024 × 600)
 *
 * Étape 1 « Bonjour » : allume l'écran, affiche « THE DECK », la version du programme,
 * un bouton qui compte les appuis et un point qui suit le doigt (pour vérifier le tactile).
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

static const char *TAG = "the-deck";

// couleurs de l'apparence « Cockpit » du logiciel
#define COL_FOND   0x07090C
#define COL_CASE   0x111820
#define COL_BORD   0x26303A
#define COL_AMBRE  0xFFB547
#define COL_TEXTE  0xE8EDF2
#define COL_GRIS   0x7D8A97

static lv_obj_t *s_compteur;   // texte « Le tactile marche : N appuis »
static lv_obj_t *s_point;      // point qui suit le doigt
static lv_obj_t *s_coord;      // coordonnées du doigt
static int s_appuis;

static void bouton_cb(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t *btn = lv_event_get_target(e);
    if (code == LV_EVENT_PRESSED) {
        lv_obj_set_style_bg_color(btn, lv_color_hex(COL_AMBRE), 0);
    } else if (code == LV_EVENT_RELEASED || code == LV_EVENT_PRESS_LOST) {
        lv_obj_set_style_bg_color(btn, lv_color_hex(COL_CASE), 0);
    } else if (code == LV_EVENT_CLICKED) {
        s_appuis++;
        lv_label_set_text_fmt(s_compteur, "Le tactile marche : %d appui%s", s_appuis, s_appuis > 1 ? "s" : "");
    }
}

// le point suit le doigt partout sur l'écran : on vérifie que le tactile tombe au bon endroit
static void ecran_cb(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_indev_t *indev = lv_indev_active();
    if (indev == NULL) {
        return;
    }
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

static void ecran_bonjour(void)
{
    lv_obj_t *scr = lv_screen_active();
    lv_obj_clean(scr);
    lv_obj_set_style_bg_color(scr, lv_color_hex(COL_FOND), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_event_cb(scr, ecran_cb, LV_EVENT_ALL, NULL);

    // cadre fin de la couleur des cases
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
    lv_obj_align(titre, LV_ALIGN_TOP_MID, 0, 70);

    char ligne[64];
    snprintf(ligne, sizeof ligne, "Programme de l'ecran - version %s", esp_app_get_description()->version);
    lv_obj_t *ver = texte(scr, ligne, &lv_font_montserrat_24, COL_GRIS);
    lv_obj_align(ver, LV_ALIGN_TOP_MID, 0, 140);

    // grand bouton, dans le style des cases du logiciel
    lv_obj_t *btn = lv_button_create(scr);
    lv_obj_set_size(btn, 360, 150);
    lv_obj_align(btn, LV_ALIGN_CENTER, 0, 30);
    lv_obj_set_style_bg_color(btn, lv_color_hex(COL_CASE), 0);
    lv_obj_set_style_border_color(btn, lv_color_hex(COL_AMBRE), 0);
    lv_obj_set_style_border_width(btn, 3, 0);
    lv_obj_set_style_radius(btn, 20, 0);
    lv_obj_set_style_shadow_width(btn, 0, 0);
    lv_obj_add_event_cb(btn, bouton_cb, LV_EVENT_ALL, NULL);
    lv_obj_t *bt = texte(btn, "Touche-moi", &lv_font_montserrat_32, COL_TEXTE);
    lv_obj_center(bt);

    s_compteur = texte(scr, "Touche le bouton pour tester le tactile", &lv_font_montserrat_24, COL_TEXTE);
    lv_obj_align(s_compteur, LV_ALIGN_BOTTOM_MID, 0, -110);

    s_coord = texte(scr, "Pose le doigt n'importe ou : un point doit apparaitre dessous", &lv_font_montserrat_16, COL_GRIS);
    lv_obj_align(s_coord, LV_ALIGN_BOTTOM_MID, 0, -60);

    s_point = lv_obj_create(scr);
    lv_obj_set_size(s_point, 24, 24);
    lv_obj_set_style_radius(s_point, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(s_point, lv_color_hex(COL_AMBRE), 0);
    lv_obj_set_style_border_width(s_point, 0, 0);
    lv_obj_remove_flag(s_point, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_point, LV_OBJ_FLAG_HIDDEN | LV_OBJ_FLAG_IGNORE_LAYOUT);
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

    ESP_ERROR_CHECK(bsp_display_lock(-1) ? ESP_OK : ESP_ERR_TIMEOUT);
    ecran_bonjour();
    bsp_display_unlock();
}
