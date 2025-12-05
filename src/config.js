// Game Configuration
export const CONFIG = {
    // Rendering
    RENDER_DISTANCE_DEFAULT: 6,
    RENDER_DISTANCES: [
        { name: 'Tiny', val: 2 },
        { name: 'Short', val: 4 },
        { name: 'Normal', val: 8 },
        { name: 'Far', val: 12 },
        { name: 'Very Far', val: 16 },
        { name: 'Extreme', val: 24 },
        { name: 'Insane', val: 32 }
    ],

    // World
    CHUNK_SIZE: 16,
    SECTION_SIZE: 16,
    WORLD_HEIGHT: 320,
    SEA_LEVEL: 62,

    // Player
    PLAYER_HEIGHT: 1.8,
    PLAYER_RADIUS: 0.3,
    EYE_HEIGHT_STANDING: 1.62,
    EYE_HEIGHT_SNEAKING: 1.32,
    PLAYER_SPEED: 4.317,
    PLAYER_RUN_SPEED: 5.612,
    PLAYER_SNEAK_SPEED: 1.3,
    JUMP_FORCE: 9.0,
    GRAVITY: 32.0,

    // Health
    MAX_HEALTH: 20,

    // Day/Night
    DAY_DURATION: 300, // seconds

    // Colors
    SKY_COLOR_DAY: 0x88AAFF,
    SKY_COLOR_NIGHT: 0x000000,
    SUN_COLOR: 0xffffff,
    MOON_COLOR: 0x1a1a2e,
    WATER_COLOR: 0x0000FF, // Deep pure blue

    // Inventory
    TOTAL_SLOTS: 36,
    HOTBAR_SLOTS: 9,
    MAX_STACK: 64,
};