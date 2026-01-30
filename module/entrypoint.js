import { migrateItemsIfNeeded } from "./migrations/items.js";
import { migrateActorsIfNeeded } from "./migrations/actors.js";
import startupHandler from './handlers/startup.js';
import initHandler from './handlers/init.js';
import { dumpAEKeys } from "./dev/ae-keys-dump.js";
import { openStaminaDialog, getActiveStaminaEffect, consumeStaminaEffect } from "./systems/stamina/stamina-dialog.js";
import {
    applyPhysicalExertionBonus,
    applyPhysicalExertionToSkill,
    applyPowerAttackBonus,
    applySprintBonus,
    applyPowerDrawBonus,
    applyPowerBlockBonus,
    hasStaminaEffect
} from "./systems/stamina/stamina-integration-hooks.js";
import { AttackTracker } from "./systems/combat/attack-tracker.js";
import { initializeUpkeepSystem } from "./systems/magic/upkeep-workflow.js";
import { initializeDamageApplication } from "./systems/magic/damage-application.js";

Hooks.once('ready', async function () {
    console.log(`UESRPG | Ready`);
    await migrateActorsIfNeeded();
    await migrateItemsIfNeeded();
    await startupHandler();

    // Initialize spell upkeep system
    initializeUpkeepSystem();

    // Initialize magic damage application
    initializeDamageApplication();
});

Hooks.once("init", async function () {
    console.log(`UESRPG | Initializing`);
    await initHandler();

    // Register Handlebars helpers
    Handlebars.registerHelper('capitalize', function (str) {
        const s = String(str || '');
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    });
    // Expose AE key inspection helper
    game.uesrpg = game.uesrpg || {};
    game.uesrpg.dumpAEKeys = dumpAEKeys;

    // Expose stamina helpers
    game.uesrpg.stamina = {
        openDialog: openStaminaDialog,
        getActiveEffect: getActiveStaminaEffect,
        consumeEffect: consumeStaminaEffect,
        applyPhysicalExertion: applyPhysicalExertionBonus,
        applyPhysicalExertionToSkill,
        applyPowerAttack: applyPowerAttackBonus,
        applySprint: applySprintBonus,
        applyPowerDraw: applyPowerDrawBonus,
        applyPowerBlock: applyPowerBlockBonus,
        hasEffect: hasStaminaEffect
    };

    // Expose attack tracker
    game.uesrpg.AttackTracker = AttackTracker;

    // Note: The prior GM-only "AE Keys" sheet header button was a debugging aid.
    // It has been removed; the helper remains available as game.uesrpg.dumpAEKeys(...).
});
