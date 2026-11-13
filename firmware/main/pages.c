/*
 * The Deck — pages de l'écran (étape 3) : réception, mémoire flash, affichage et appuis.
 *
 * Paquet (petit-boutiste, voir PROTOCOLE.md) :
 *   en-tête (24 octets) : "DECK", version 1, nombre de pages, début et taille des textes, taille totale
 *   table des pages (20 octets chacune) : position et taille du JPEG, première zone, nombre de zones, couleur
 *   zones (28 octets chacune) : rectangle, ce que fait la zone, comportement (appui, maintenir, bascule)
 *   textes (messages JSON pour le logiciel, terminés par 0), puis les images JPEG.
 */
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_partition.h"
#include "esp_heap_caps.h"
#include "driver/jpeg_decode.h"
#include "mbedtls/base64.h"
#include "lvgl.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "usb_deck.h"
#include "pages.h"

static const char *TAG = "pages";

#define W 1024
#define H 600
#define H_PAD 608                         // le décodeur JPEG travaille par bandes de 16 lignes
#define BLOC 0x10000                      // effacement de la mémoire flash par blocs de 64 Ko
#define CHUNK_MAX 12288                   // un morceau reçu (8 Ko) une fois le base64 décodé

typedef struct __attribute__((packed)) {
    char magic[4];
    uint16_t version, count;
    uint32_t str_off, str_len, total, rsv;
} pack_hdr_t;

typedef struct __attribute__((packed)) {
    uint32_t jpeg_off, jpeg_len, zone_first;
    uint16_t zone_count, rsv;
    uint32_t accent;                      // couleur d'appui (0xRRGGBB)
} pack_page_t;

typedef struct __attribute__((packed)) {
    uint16_t x, y, w, h;
    uint8_t kind, mode, radius, rsv;
    uint16_t hold_ms, v1, v2, rsv2;
    uint32_t s_down, s_up;                // messages (position dans les textes, 0xFFFFFFFF = aucun)
} pack_zone_t;

_Static_assert(sizeof(pack_hdr_t) == 24, "en-tete");
_Static_assert(sizeof(pack_page_t) == 20, "page");
_Static_assert(sizeof(pack_zone_t) == 28, "zone");

enum { Z_RIEN, Z_TOUCHE, Z_MANETTE, Z_MEDIA, Z_PAGE, Z_MESSAGE };
enum { M_APPUI, M_MAINTENIR, M_BASCULE };
#define AUCUN 0xFFFFFFFFu

static const esp_partition_t *s_part;
static jpeg_decoder_handle_t s_dec;
static uint8_t *s_out[2];                 // deux images décodées (on affiche l'une pendant qu'on prépare l'autre)
static size_t s_out_size;
static uint8_t *s_in;                     // JPEG lu dans la mémoire flash
static size_t s_in_size;
static lv_image_dsc_t s_dsc[2];
static int s_cur_buf;

// pages gardées (copie en mémoire vive de l'en-tête, des pages, des zones et des textes)
static uint8_t *s_meta;
static const pack_hdr_t *s_hdr;
static const pack_page_t *s_pages;
static const pack_zone_t *s_zones;
static const char *s_str;
static uint8_t *s_on;                     // cases en bascule allumées (une par zone)
static int s_count;
static int s_page = -1;

static lv_obj_t *s_scr, *s_img, *s_layer, *s_info, *s_info_txt;
static lv_obj_t *s_hit;                   // contour de la case appuyée
static lv_obj_t *s_bar;                   // barre de « maintenir »
static int s_active = -1;                 // zone appuyée
static int64_t s_t0;
static bool s_fired;
static lv_timer_t *s_hold_timer;

// réception
static volatile bool s_rx;
static size_t s_rx_size, s_rx_done, s_rx_erased;
static uint32_t s_rx_crc, s_rx_want;
static uint8_t *s_rx_buf;
static volatile int s_rx_pct = -1;
static bool s_ready;                      // décodeur et mémoire prêts

int pages_count(void) { return s_count; }

static uint32_t crc32_upd(uint32_t c, const uint8_t *p, size_t n)
{
    c = ~c;
    while (n--) {
        c ^= *p++;
        for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1u)));
    }
    return ~c;
}

// ---------- lecture des pages gardées ----------
static void meta_free(void)
{
    free(s_meta); s_meta = NULL;
    free(s_on); s_on = NULL;
    s_hdr = NULL; s_pages = NULL; s_zones = NULL; s_str = NULL;
    s_count = 0;
}

static bool meta_load(void)
{
    meta_free();
    if (!s_part) return false;
    pack_hdr_t h;
    if (esp_partition_read(s_part, 0, &h, sizeof h) != ESP_OK) return false;
    if (memcmp(h.magic, "DECK", 4) != 0 || h.version != 1 || h.count == 0) return false;
    size_t meta_len = (size_t)h.str_off + h.str_len;
    if (h.total > s_part->size || meta_len > h.total || meta_len > 4 * 1024 * 1024) return false;
    s_meta = heap_caps_malloc(meta_len + 1, MALLOC_CAP_SPIRAM);
    if (!s_meta || esp_partition_read(s_part, 0, s_meta, meta_len) != ESP_OK) { meta_free(); return false; }
    s_meta[meta_len] = 0;
    s_hdr = (const pack_hdr_t *)s_meta;
    s_pages = (const pack_page_t *)(s_meta + sizeof(pack_hdr_t));
    size_t nz = 0;
    for (int i = 0; i < h.count; i++) {
        size_t end = (size_t)s_pages[i].zone_first + s_pages[i].zone_count;
        if (end > nz) nz = end;
        if ((size_t)s_pages[i].jpeg_off + s_pages[i].jpeg_len > h.total) { meta_free(); return false; }
    }
    s_zones = (const pack_zone_t *)(s_meta + sizeof(pack_hdr_t) + h.count * sizeof(pack_page_t));
    if ((const uint8_t *)(s_zones + nz) > s_meta + h.str_off) { meta_free(); return false; }
    s_str = (const char *)(s_meta + h.str_off);
    s_on = calloc(nz ? nz : 1, 1);
    s_count = h.count;
    ESP_LOGI(TAG, "%d pages, %u zones", s_count, (unsigned)nz);
    return true;
}

static const char *str_at(uint32_t off)
{
    if (off == AUCUN || !s_hdr || off >= s_hdr->str_len) return NULL;
    return s_str + off;
}

// ---------- affichage ----------
static bool decode_page(int i, uint8_t *out)
{
    const pack_page_t *p = &s_pages[i];
    if (p->jpeg_len > s_in_size) {
        if (s_in) free(s_in);
        jpeg_decode_memory_alloc_cfg_t mi = { .buffer_direction = JPEG_DEC_ALLOC_INPUT_BUFFER };
        s_in = (uint8_t *)jpeg_alloc_decoder_mem(p->jpeg_len, &mi, &s_in_size);
        if (!s_in) { s_in_size = 0; return false; }
    }
    if (esp_partition_read(s_part, p->jpeg_off, s_in, p->jpeg_len) != ESP_OK) return false;
    jpeg_decode_cfg_t cfg = {
        .output_format = JPEG_DECODE_OUT_FORMAT_RGB565,
        .rgb_order = JPEG_DEC_RGB_ELEMENT_ORDER_BGR,
        .conv_std = JPEG_YUV_RGB_CONV_STD_BT601,
    };
    uint32_t n = 0;
    esp_err_t err = jpeg_decoder_process(s_dec, &cfg, s_in, p->jpeg_len, out, s_out_size, &n);
    if (err != ESP_OK) ESP_LOGW(TAG, "page %d : image illisible (%s)", i, esp_err_to_name(err));
    return err == ESP_OK;
}

static lv_obj_t *contour(const pack_zone_t *z, uint32_t couleur)
{
    lv_obj_t *o = lv_obj_create(s_layer);
    lv_obj_remove_style_all(o);
    lv_obj_set_pos(o, z->x, z->y);
    lv_obj_set_size(o, z->w, z->h);
    lv_obj_set_style_radius(o, z->radius, 0);
    lv_obj_set_style_border_width(o, 3, 0);
    lv_obj_set_style_border_color(o, lv_color_hex(couleur), 0);
    lv_obj_set_style_border_opa(o, LV_OPA_COVER, 0);
    lv_obj_remove_flag(o, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    return o;
}

static void press_reset(void)
{
    if (s_hold_timer) { lv_timer_delete(s_hold_timer); s_hold_timer = NULL; }
    s_hit = NULL; s_bar = NULL;
    s_active = -1;
}

// contours des cases en bascule allumées
static void draw_layer(void)
{
    lv_obj_clean(s_layer);
    s_hit = NULL; s_bar = NULL;
    const pack_page_t *p = &s_pages[s_page];
    for (int k = 0; k < p->zone_count; k++) {
        if (s_on[p->zone_first + k]) contour(&s_zones[p->zone_first + k], p->accent);
    }
}

static void show_page(int i)
{
    if (i < 0 || i >= s_count) i = 0;
    int b = s_cur_buf ^ 1;
    if (!decode_page(i, s_out[b])) return;
    s_cur_buf = b;
    lv_image_set_src(s_img, &s_dsc[b]);
    lv_obj_invalidate(s_img);
    press_reset();
    s_page = i;
    draw_layer();
}

// ---------- appuis ----------
static void fire(const pack_zone_t *z, bool down)
{
    switch (z->kind) {
    case Z_TOUCHE:   usb_deck_combo((uint8_t)z->v1, (uint8_t)z->v2, down); break;
    case Z_MANETTE:  usb_deck_pad((uint8_t)z->v1, down); break;
    case Z_MEDIA:    usb_deck_media(z->v1, down); break;
    case Z_MESSAGE: {
        const char *m = str_at(down ? z->s_down : z->s_up);
        if (m) usb_deck_send_line(m);
        break;
    }
    default: break;
    }
}

static const pack_zone_t *s_pulse_zone;
static void pulse_end(lv_timer_t *t)
{
    (void)t;
    if (s_pulse_zone) fire(s_pulse_zone, false);
    s_pulse_zone = NULL;
}

// appui bref (pour « maintenir » et « bascule ») : on relâche 80 ms plus tard, assez pour que le jeu le voie
static void pulse(const pack_zone_t *z)
{
    if (z->kind == Z_PAGE) { show_page(z->v1); return; }
    if (s_pulse_zone) fire(s_pulse_zone, false);
    fire(z, true);
    if (z->kind == Z_MESSAGE) { fire(z, false); return; }
    s_pulse_zone = z;
    lv_timer_t *t = lv_timer_create(pulse_end, 80, NULL);
    lv_timer_set_repeat_count(t, 1);
}

static void hold_tick(lv_timer_t *t)
{
    (void)t;
    if (s_active < 0 || s_fired) return;
    const pack_zone_t *z = &s_zones[s_active];
    int64_t ms = (esp_timer_get_time() - s_t0) / 1000;
    int hold = z->hold_ms ? z->hold_ms : 1500;
    if (s_bar) lv_obj_set_width(s_bar, (int32_t)(z->w * (ms > hold ? hold : ms) / hold));
    if (ms >= hold) {
        s_fired = true;
        if (s_bar) { lv_obj_delete(s_bar); s_bar = NULL; }
        int page = s_page;
        pulse(z);
        if (page != s_page) return;   // la page a changé : tout est déjà effacé
    }
}

static int zone_at(int x, int y)
{
    if (s_page < 0) return -1;
    const pack_page_t *p = &s_pages[s_page];
    for (int k = p->zone_count - 1; k >= 0; k--) {
        const pack_zone_t *z = &s_zones[p->zone_first + k];
        if (z->kind == Z_RIEN) continue;
        if (x >= z->x && x < z->x + z->w && y >= z->y && y < z->y + z->h) return (int)(p->zone_first + k);
    }
    return -1;
}

static void touch_cb(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    if (s_rx || s_count == 0) return;
    lv_indev_t *indev = lv_indev_active();
    if (!indev) return;
    if (code == LV_EVENT_PRESSED) {
        lv_point_t pt;
        lv_indev_get_point(indev, &pt);
        press_reset();
        int zi = zone_at(pt.x, pt.y);
        if (zi < 0) return;
        const pack_zone_t *z = &s_zones[zi];
        uint32_t acc = s_pages[s_page].accent;
        s_active = zi;
        s_t0 = esp_timer_get_time();
        s_fired = false;
        if (!s_on[zi]) s_hit = contour(z, acc);
        if (z->mode == M_MAINTENIR) {
            s_bar = lv_obj_create(s_layer);
            lv_obj_remove_style_all(s_bar);
            lv_obj_set_pos(s_bar, z->x, z->y + z->h - 6);
            lv_obj_set_size(s_bar, 0, 6);
            lv_obj_set_style_bg_color(s_bar, lv_color_hex(acc), 0);
            lv_obj_set_style_bg_opa(s_bar, LV_OPA_COVER, 0);
            s_hold_timer = lv_timer_create(hold_tick, 30, NULL);
        } else if (z->mode == M_APPUI && z->kind != Z_PAGE) {
            fire(z, true);   // tant que le doigt reste posé, la touche reste enfoncée
        }
    } else if (code == LV_EVENT_RELEASED || code == LV_EVENT_PRESS_LOST) {
        int zi = s_active;
        if (zi < 0) return;
        const pack_zone_t *z = &s_zones[zi];
        bool lost = code == LV_EVENT_PRESS_LOST;
        if (s_hit) { lv_obj_delete(s_hit); s_hit = NULL; }
        if (s_bar) { lv_obj_delete(s_bar); s_bar = NULL; }
        if (s_hold_timer) { lv_timer_delete(s_hold_timer); s_hold_timer = NULL; }
        s_active = -1;
        if (z->mode == M_APPUI) {
            if (z->kind == Z_PAGE) { if (!lost) show_page(z->v1); }
            else fire(z, false);
        } else if (z->mode == M_BASCULE && !lost) {
            s_on[zi] = !s_on[zi];
            int page = s_page;
            pulse(z);
            if (page == s_page) draw_layer();   // redessine les contours allumés
        }
    }
}

// ---------- bandeau « réception » / « mise à jour » ----------
static void info_timer(lv_timer_t *t)
{
    (void)t;
    int ota = usb_deck_update_pct();
    char txt[64] = "";
    if (s_rx_pct >= 0) snprintf(txt, sizeof txt, "Reception des pages : %d %%", s_rx_pct);
    else if (ota >= 0 && lv_screen_active() == s_scr) snprintf(txt, sizeof txt, "Mise a jour du programme : %d %%", ota);
    if (txt[0]) {
        lv_label_set_text(s_info_txt, txt);
        lv_obj_remove_flag(s_info, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(s_info, LV_OBJ_FLAG_HIDDEN);
    }
}

// ---------- démarrage ----------
bool pages_start(void)
{
    s_part = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "pages");
    if (!s_part) { ESP_LOGE(TAG, "espace « pages » introuvable"); return false; }

    jpeg_decode_engine_cfg_t ecfg = { .intr_priority = 0, .timeout_ms = 200 };
    if (jpeg_new_decoder_engine(&ecfg, &s_dec) != ESP_OK) { ESP_LOGE(TAG, "decodeur JPEG indisponible"); s_part = NULL; return false; }
    jpeg_decode_memory_alloc_cfg_t mo = { .buffer_direction = JPEG_DEC_ALLOC_OUTPUT_BUFFER };
    for (int b = 0; b < 2; b++) {
        s_out[b] = (uint8_t *)jpeg_alloc_decoder_mem(W * H_PAD * 2, &mo, &s_out_size);
        if (!s_out[b]) { ESP_LOGE(TAG, "pas assez de memoire"); s_part = NULL; return false; }
        memset(s_out[b], 0, s_out_size);
        s_dsc[b].header.magic = LV_IMAGE_HEADER_MAGIC;
        s_dsc[b].header.cf = LV_COLOR_FORMAT_RGB565;
        s_dsc[b].header.w = W;
        s_dsc[b].header.h = H;
        s_dsc[b].header.stride = W * 2;
        s_dsc[b].data_size = W * H * 2;
        s_dsc[b].data = s_out[b];
    }

    s_scr = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(s_scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_event_cb(s_scr, touch_cb, LV_EVENT_ALL, NULL);
    s_img = lv_image_create(s_scr);
    lv_obj_set_pos(s_img, 0, 0);
    lv_obj_remove_flag(s_img, LV_OBJ_FLAG_CLICKABLE);
    s_layer = lv_obj_create(s_scr);
    lv_obj_remove_style_all(s_layer);
    lv_obj_set_size(s_layer, W, H);
    lv_obj_remove_flag(s_layer, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);

    // bandeau au-dessus de tout (aussi sur l'écran de test)
    s_info = lv_obj_create(lv_layer_top());
    lv_obj_set_size(s_info, 560, 90);
    lv_obj_center(s_info);
    lv_obj_set_style_bg_color(s_info, lv_color_hex(0x07090C), 0);
    lv_obj_set_style_bg_opa(s_info, LV_OPA_90, 0);
    lv_obj_set_style_border_color(s_info, lv_color_hex(0xFFB547), 0);
    lv_obj_set_style_border_width(s_info, 2, 0);
    lv_obj_set_style_radius(s_info, 16, 0);
    lv_obj_remove_flag(s_info, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    s_info_txt = lv_label_create(s_info);
    lv_obj_set_style_text_font(s_info_txt, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(s_info_txt, lv_color_hex(0xFFB547), 0);
    lv_obj_center(s_info_txt);
    lv_obj_add_flag(s_info, LV_OBJ_FLAG_HIDDEN);
    lv_timer_create(info_timer, 250, NULL);
    s_ready = true;

    if (!meta_load()) return false;
    show_page(0);
    if (s_page < 0) return false;
    lv_screen_load(s_scr);
    return true;
}

// ---------- réception des pages (pg-begin, pg-data, pg-end) ----------
static void rx_fail(const char *why)
{
    char rep[160];
    snprintf(rep, sizeof rep, "{\"t\":\"pg-err\",\"msg\":\"%s\"}", why);
    usb_deck_send_line(rep);
    s_rx = false;
    s_rx_pct = -1;
    ESP_LOGW(TAG, "reception : %s", why);
}

static void ack(void)
{
    char rep[64];
    snprintf(rep, sizeof rep, "{\"t\":\"pg-ack\",\"off\":%u}", (unsigned)s_rx_done);
    usb_deck_send_line(rep);
}

void pages_line(const char *t, const char *line)
{
    if (!s_part || !s_ready) { usb_deck_send_line("{\"t\":\"pg-err\",\"msg\":\"memoire des pages introuvable\"}"); return; }
    if (strcmp(t, "pg-begin") == 0) {
        long size = 0;
        json_num(line, "size", &size);
        const char *pc = strstr(line, "\"crc\":");
        uint32_t crc = pc ? (uint32_t)strtoul(pc + 6, NULL, 10) : 0;   // jusqu'à 4 294 967 295 : pas de strtol
        if (size <= (long)sizeof(pack_hdr_t) || (size_t)size > s_part->size) { rx_fail("pages trop grandes pour la memoire de l'ecran"); return; }
        if (!s_rx_buf) s_rx_buf = heap_caps_malloc(CHUNK_MAX, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
        if (!s_rx_buf) { rx_fail("pas assez de memoire"); return; }
        // on arrête d'utiliser les anciennes pages : elles vont être remplacées
        bsp_display_lock(-1);
        s_rx = true;
        press_reset();
        bsp_display_unlock();
        s_rx_size = (size_t)size;
        s_rx_done = 0;
        s_rx_erased = 0;
        s_rx_crc = 0;
        s_rx_want = crc;
        s_rx_pct = 0;
        ESP_LOGI(TAG, "reception de %u octets", (unsigned)s_rx_size);
        ack();
    } else if (strcmp(t, "pg-data") == 0) {
        if (!s_rx) { rx_fail("pas d'envoi en cours"); return; }
        long off = -1;
        json_num(line, "off", &off);
        if (off != (long)s_rx_done) { ack(); return; }   // morceau déjà reçu ou perdu : on redit où on en est
        const char *p = strstr(line, "\"b64\":\"");
        if (!p) { rx_fail("morceau illisible"); return; }
        p += 7;
        const char *q = strchr(p, '"');
        size_t n = 0;
        if (!q || mbedtls_base64_decode(s_rx_buf, CHUNK_MAX, &n, (const unsigned char *)p, (size_t)(q - p)) != 0 || n == 0) { rx_fail("morceau abime"); return; }
        if (s_rx_done + n > s_rx_size) { rx_fail("pages trop longues"); return; }
        s_rx_crc = crc32_upd(s_rx_crc, s_rx_buf, n);
        while (s_rx_erased < s_rx_done + n) {
            if (esp_partition_erase_range(s_part, s_rx_erased, BLOC) != ESP_OK) { rx_fail("effacement de la memoire impossible"); return; }
            s_rx_erased += BLOC;
        }
        // « DECK » n'est écrit qu'à la fin : des pages à moitié reçues ne sont jamais utilisées
        if (s_rx_done == 0 && n >= 4) memset(s_rx_buf, 0xFF, 4);
        if (esp_partition_write(s_part, s_rx_done, s_rx_buf, n) != ESP_OK) { rx_fail("ecriture en memoire impossible"); return; }
        s_rx_done += n;
        s_rx_pct = (int)(s_rx_done * 100 / s_rx_size);
        ack();
    } else if (strcmp(t, "pg-end") == 0) {
        if (!s_rx || s_rx_done != s_rx_size) { rx_fail("pages incompletes"); return; }
        if (s_rx_crc != s_rx_want) { rx_fail("pages abimees pendant l'envoi"); return; }
        static const char magic[4] = { 'D', 'E', 'C', 'K' };
        char mg[4];
        memcpy(mg, magic, 4);
        if (esp_partition_write(s_part, 0, mg, 4) != ESP_OK) { rx_fail("ecriture en memoire impossible"); return; }
        bsp_display_lock(-1);
        bool ok = meta_load();
        if (ok) {
            s_page = -1;
            show_page(0);
            ok = s_page >= 0;
            if (ok) lv_screen_load(s_scr);
        }
        s_rx = false;
        s_rx_pct = -1;
        bsp_display_unlock();
        if (!ok) { usb_deck_send_line("{\"t\":\"pg-err\",\"msg\":\"pages recues mais illisibles\"}"); return; }
        char rep[64];
        snprintf(rep, sizeof rep, "{\"t\":\"pg-done\",\"count\":%d}", s_count);
        usb_deck_send_line(rep);
    }
}
