/*
 * The Deck — USB de l'écran : clavier + touches multimédia + manette (HID) et liaison série (CDC).
 * esp_tinyusb 3 (TinyUSB), port USB pleine vitesse de l'ESP32-P4 = prise Type-C « USB » de la carte.
 */
#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_app_desc.h"
#include "tinyusb.h"
#include "tinyusb_default_config.h"
#include "tinyusb_cdc_acm.h"
#include "class/hid/hid_device.h"
#include "driver/gpio.h"
#include "hal/usb_wrap_ll.h"
#include "usb_deck.h"

static const char *TAG = "usb";

// 0 = prise Type-C « USB » (pleine vitesse) ; 1 = port haute vitesse (prise Type-A « USB-OTG »)
#define DECK_USB_HAUTE_VITESSE 0

// ---------- descripteurs USB ----------
#define DECK_VID 0x303A   // Espressif (le logiciel reconnaît l'écran à ce numéro)
#define DECK_PID 0x81D3   // « The Deck »

enum { RID_KEYBOARD = 1, RID_MEDIA = 2, RID_PAD = 3 };

static const uint8_t s_hid_report[] = {
    TUD_HID_REPORT_DESC_KEYBOARD(HID_REPORT_ID(RID_KEYBOARD)),
    TUD_HID_REPORT_DESC_CONSUMER(HID_REPORT_ID(RID_MEDIA)),
    TUD_HID_REPORT_DESC_GAMEPAD(HID_REPORT_ID(RID_PAD)),
};

enum { ITF_CDC = 0, ITF_CDC_DATA, ITF_HID, ITF_TOTAL };
#define EP_CDC_NOTIF 0x81
#define EP_CDC_OUT   0x02
#define EP_CDC_IN    0x82
#define EP_HID_IN    0x83
#define CFG_LEN (TUD_CONFIG_DESC_LEN + TUD_CDC_DESC_LEN + TUD_HID_DESC_LEN)

// chaînes : 0 langue, 1 fabricant, 2 produit, 3 numéro de série (NULL = adresse MAC), 4 liaison, 5 touches
static const char *s_strings[] = {
    (const char[]){0x09, 0x04},
    "The Deck",
    "The Deck",
    NULL,
    "The Deck - liaison",
    "The Deck - touches et manette",
};

static const tusb_desc_device_t s_device = {
    .bLength = sizeof(tusb_desc_device_t),
    .bDescriptorType = TUSB_DESC_DEVICE,
    .bcdUSB = 0x0200,
    .bDeviceClass = TUSB_CLASS_MISC,          // composite avec IAD (à cause du CDC)
    .bDeviceSubClass = MISC_SUBCLASS_COMMON,
    .bDeviceProtocol = MISC_PROTOCOL_IAD,
    .bMaxPacketSize0 = CFG_TUD_ENDPOINT0_SIZE,
    .idVendor = DECK_VID,
    .idProduct = DECK_PID,
    .bcdDevice = 0x0100,
    .iManufacturer = 1,
    .iProduct = 2,
    .iSerialNumber = 3,
    .bNumConfigurations = 1,
};

#if DECK_USB_HAUTE_VITESSE
static const tusb_desc_device_qualifier_t s_qualifier = {
    .bLength = sizeof(tusb_desc_device_qualifier_t),
    .bDescriptorType = TUSB_DESC_DEVICE_QUALIFIER,
    .bcdUSB = 0x0200,
    .bDeviceClass = TUSB_CLASS_MISC,
    .bDeviceSubClass = MISC_SUBCLASS_COMMON,
    .bDeviceProtocol = MISC_PROTOCOL_IAD,
    .bMaxPacketSize0 = CFG_TUD_ENDPOINT0_SIZE,
    .bNumConfigurations = 1,
    .bReserved = 0,
};
#endif

// pleine vitesse (12 Mbit/s) : paquets de 64 octets, interrogation toutes les 1 ms
static const uint8_t s_cfg_fs[] = {
    TUD_CONFIG_DESCRIPTOR(1, ITF_TOTAL, 0, CFG_LEN, 0, 500),
    TUD_CDC_DESCRIPTOR(ITF_CDC, 4, EP_CDC_NOTIF, 8, EP_CDC_OUT, EP_CDC_IN, 64),
    TUD_HID_DESCRIPTOR(ITF_HID, 5, HID_ITF_PROTOCOL_NONE, sizeof(s_hid_report), EP_HID_IN, 16, 1),
};
#if DECK_USB_HAUTE_VITESSE
// haute vitesse (480 Mbit/s) : paquets de 512 octets, interrogation toutes les 8 micro-trames = 1 ms
static const uint8_t s_cfg_hs[] = {
    TUD_CONFIG_DESCRIPTOR(1, ITF_TOTAL, 0, CFG_LEN, 0, 500),
    TUD_CDC_DESCRIPTOR(ITF_CDC, 4, EP_CDC_NOTIF, 8, EP_CDC_OUT, EP_CDC_IN, 512),
    TUD_HID_DESCRIPTOR(ITF_HID, 5, HID_ITF_PROTOCOL_NONE, sizeof(s_hid_report), EP_HID_IN, 16, 4),
};
#endif

// ---------- rappels demandés par TinyUSB ----------
uint8_t const *tud_hid_descriptor_report_cb(uint8_t instance)
{
    (void)instance;
    return s_hid_report;
}

uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type, uint8_t *buffer, uint16_t reqlen)
{
    (void)instance; (void)report_id; (void)report_type; (void)buffer; (void)reqlen;
    return 0;
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type, uint8_t const *buffer, uint16_t bufsize)
{
    (void)instance; (void)report_id; (void)report_type; (void)buffer; (void)bufsize;
}

// ---------- envoi des touches : une file, une tâche qui attend que l'USB soit prêt ----------
typedef enum { EV_KEY, EV_MEDIA, EV_PAD } ev_kind_t;
typedef struct { ev_kind_t kind; uint16_t code; bool down; } deck_ev_t;

static QueueHandle_t s_queue;
static uint8_t s_keys[6];          // touches clavier enfoncées
static uint32_t s_buttons;         // boutons de manette enfoncés

static void key_set(uint8_t code, bool down)
{
    for (int i = 0; i < 6; i++) {
        if (down && s_keys[i] == code) return;
        if (!down && s_keys[i] == code) s_keys[i] = 0;
    }
    if (down) {
        for (int i = 0; i < 6; i++) if (!s_keys[i]) { s_keys[i] = code; return; }
    }
}

static void wait_ready(void)
{
    for (int i = 0; i < 50 && !tud_hid_ready(); i++) vTaskDelay(pdMS_TO_TICKS(1));
}

static void hid_task(void *arg)
{
    deck_ev_t ev;
    for (;;) {
        if (xQueueReceive(s_queue, &ev, portMAX_DELAY) != pdTRUE) continue;
        if (!tud_mounted()) continue;
        if (tud_suspended()) { tud_remote_wakeup(); vTaskDelay(pdMS_TO_TICKS(20)); }
        wait_ready();
        switch (ev.kind) {
        case EV_KEY:
            key_set((uint8_t)ev.code, ev.down);
            tud_hid_keyboard_report(RID_KEYBOARD, 0, s_keys);
            break;
        case EV_MEDIA: {
            uint16_t u = ev.down ? ev.code : 0;
            tud_hid_report(RID_MEDIA, &u, sizeof u);
            break;
        }
        case EV_PAD: {
            if (ev.code >= 1 && ev.code <= 32) {
                if (ev.down) s_buttons |= (1u << (ev.code - 1));
                else s_buttons &= ~(1u << (ev.code - 1));
            }
            hid_gamepad_report_t r = {0};
            r.hat = GAMEPAD_HAT_CENTERED;
            r.buttons = s_buttons;
            tud_hid_report(RID_PAD, &r, sizeof r);
            break;
        }
        }
        vTaskDelay(pdMS_TO_TICKS(2));
    }
}

static void push(ev_kind_t k, uint16_t code, bool down)
{
    deck_ev_t ev = { .kind = k, .code = code, .down = down };
    if (s_queue) xQueueSend(s_queue, &ev, pdMS_TO_TICKS(20));
}

void usb_deck_key(uint8_t hid_keycode, bool down) { push(EV_KEY, hid_keycode, down); }
void usb_deck_media(uint16_t consumer_usage, bool down) { push(EV_MEDIA, consumer_usage, down); }
void usb_deck_pad(uint8_t button, bool down) { push(EV_PAD, button, down); }

void usb_deck_type(const char *s)
{
    for (; s && *s; s++) {
        uint8_t k = 0;
        char c = *s;
        if (c >= 'a' && c <= 'z') k = HID_KEY_A + (c - 'a');
        else if (c >= '1' && c <= '9') k = HID_KEY_1 + (c - '1');
        else if (c == '0') k = HID_KEY_0;
        else if (c == ' ') k = HID_KEY_SPACE;
        if (!k) continue;
        usb_deck_key(k, true);
        usb_deck_key(k, false);
    }
}

bool usb_deck_mounted(void) { return tud_mounted(); }

// ---------- liaison série avec le logiciel (une ligne JSON par message) ----------
static char s_line[1024];
static size_t s_len;
static int64_t s_hello_us;            // dernier bonjour du logiciel
static char s_app_version[24];

bool usb_deck_app_linked(void) { return s_hello_us && (esp_timer_get_time() - s_hello_us) < 6000000; }
const char *usb_deck_app_version(void) { return s_app_version; }

void usb_deck_send_line(const char *line)
{
    if (!tud_mounted()) return;
    tinyusb_cdcacm_write_queue(TINYUSB_CDC_ACM_0, (const uint8_t *)line, strlen(line));
    tinyusb_cdcacm_write_queue_char(TINYUSB_CDC_ACM_0, '\n');
    tinyusb_cdcacm_write_flush(TINYUSB_CDC_ACM_0, 0);
}

// lit la valeur texte "clé":"valeur" dans une ligne JSON simple
static bool json_str(const char *line, const char *key, char *out, size_t n)
{
    char pat[32];
    snprintf(pat, sizeof pat, "\"%s\":\"", key);
    const char *p = strstr(line, pat);
    if (!p) return false;
    p += strlen(pat);
    size_t i = 0;
    while (*p && *p != '"' && i + 1 < n) out[i++] = *p++;
    out[i] = 0;
    return true;
}

static void on_line(const char *line)
{
    char t[16] = "";
    json_str(line, "t", t, sizeof t);
    if (strcmp(t, "hello") == 0) {
        s_hello_us = esp_timer_get_time();
        json_str(line, "app", s_app_version, sizeof s_app_version);
        char rep[96];
        snprintf(rep, sizeof rep, "{\"t\":\"hello\",\"fw\":\"%s\",\"etape\":2}", esp_app_get_description()->version);
        usb_deck_send_line(rep);
    } else if (strcmp(t, "config") == 0) {
        // étape 3 : les pages arriveront en images
        usb_deck_send_line("ERR le programme de l'ecran ne recoit pas encore les pages (etape 3)");
    }
    // media, clips : ignorés pour l'instant
}

static void cdc_rx(int itf, cdcacm_event_t *event)
{
    (void)event;
    uint8_t buf[256];
    size_t n = 0;
    while (tinyusb_cdcacm_read(itf, buf, sizeof buf, &n) == ESP_OK && n > 0) {
        for (size_t i = 0; i < n; i++) {
            char c = (char)buf[i];
            if (c == '\n') {
                s_line[s_len] = 0;
                if (s_len) on_line(s_line);
                s_len = 0;
            } else if (c != '\r') {
                if (s_len + 1 < sizeof s_line) s_line[s_len++] = c;
                else s_len = 0;   // ligne trop longue (image…) : ignorée pour l'instant
            }
        }
    }
}

// ---------- démarrage ----------
void usb_deck_start(void)
{
    s_queue = xQueueCreate(64, sizeof(deck_ev_t));
    xTaskCreate(hid_task, "deck_hid", 4096, NULL, 6, NULL);

    // La prise Type-C « USB » de la carte 7B est reliée au port USB pleine vitesse (12 Mbit/s) de l'ESP32-P4.
    // (Le port haute vitesse va à la prise Type-A « USB-OTG », faite pour brancher une clé ou un clavier.)
#if DECK_USB_HAUTE_VITESSE
    tinyusb_config_t cfg = TINYUSB_CONFIG_HIGH_SPEED(NULL, NULL);
    cfg.descriptor.qualifier = &s_qualifier;
    cfg.descriptor.high_speed_config = s_cfg_hs;
#else
    // L'ESP32-P4 a deux petits « PHY » USB pleine vitesse : le n° 0 sur GPIO 24/25, câblé à la prise Type-C « USB »
    // (au départ pour USB-Serial-JTAG), et le n° 1 sur GPIO 26/27 (pas câblé sur la carte 7B), donné par défaut à
    // l'USB OTG. On échange : l'USB OTG (TinyUSB) prend le n° 0, donc la prise « USB ».
    usb_wrap_ll_phy_select(&USB_WRAP, 0);
    gpio_set_drive_capability(GPIO_NUM_24, GPIO_DRIVE_CAP_3);
    gpio_set_drive_capability(GPIO_NUM_25, GPIO_DRIVE_CAP_3);
    tinyusb_config_t cfg = TINYUSB_CONFIG_FULL_SPEED(NULL, NULL);
#endif
    cfg.descriptor.device = &s_device;
    cfg.descriptor.string = s_strings;
    cfg.descriptor.string_count = sizeof(s_strings) / sizeof(s_strings[0]);
    cfg.descriptor.full_speed_config = s_cfg_fs;
    ESP_ERROR_CHECK(tinyusb_driver_install(&cfg));

    tinyusb_config_cdcacm_t acm = {
        .cdc_port = TINYUSB_CDC_ACM_0,
        .callback_rx = cdc_rx,
    };
    ESP_ERROR_CHECK(tinyusb_cdcacm_init(&acm));
    ESP_LOGI(TAG, "USB pret (clavier, manette, liaison)");
}
