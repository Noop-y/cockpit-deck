# Programme de l'écran The Deck (ESP32-P4, ESP-IDF 5.5)
cmake_minimum_required(VERSION 3.16)
# numéro de version du programme : firmware/version.txt
file(STRINGS ${CMAKE_CURRENT_LIST_DIR}/version.txt PROJECT_VER LIMIT_COUNT 1)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
add_compile_options(-Wno-format)
project(the-deck-ecran)
