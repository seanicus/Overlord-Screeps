/**
 * Created by Bob on 6/24/2017.
 */

const profiler = require('screeps-profiler');
let _ = require('lodash');

function labManager() {
    manageActiveLabs();
    for (let key in shuffle(Memory.ownedRooms)) {
        if (Memory.ownedRooms[key].controller.level < 6) continue;
        let room = Memory.ownedRooms[key];
        let reactionRooms = _.filter(Memory.ownedRooms, (r) => r.memory.reactionRoom);
        if (!reactionRooms[0]) room.memory.reactionRoom = true;
        let targetAmount = _.round(Memory.ownedRooms.length / 4);
        if (!room.memory.reactionRoom && reactionRooms.length < targetAmount) {
            room.memory.reactionRoom = true;
            log.a(room.name + ' is now a reaction room.');
        }
        let terminal = _.filter(room.structures, (s) => s.structureType === STRUCTURE_TERMINAL)[0];
        let lab = _.filter(room.structures, (s) => s.structureType === STRUCTURE_LAB)[0];
        if (lab && terminal && room.memory.reactionRoom && Game.time % 25 === 0) manageBoostProduction(room);
    }
}

module.exports.labManager = profiler.registerFN(labManager, 'labManager');

function manageBoostProduction(room) {
    let storage = _.filter(room.structures, (s) => s.structureType === STRUCTURE_STORAGE)[0];
    let terminal = _.filter(room.structures, (s) => s.structureType === STRUCTURE_TERMINAL)[0];
    let labTech = _.filter(room.creeps, (c) => c.memory && c.memory.role === 'labTech')[0];
    boost:
        for (let key in MAKE_THESE_BOOSTS) {
            let boost = MAKE_THESE_BOOSTS[key];
            let availableLabs = _.filter(room.structures, (s) => s.structureType === STRUCTURE_LAB && !s.memory.active && s.pos.findInRange(room.structures, 2, {filter: (l) => l.structureType === STRUCTURE_LAB && !l.memory.active}).length >= 2)[0];
            if (!availableLabs) return;
            for (let key in BOOST_COMPONENTS[boost]) {
                let storageAmount = storage.store[BOOST_COMPONENTS[boost][key]] || 0;
                let terminalAmount = terminal.store[BOOST_COMPONENTS[boost][key]] || 0;
                let techAmount;
                if (labTech) techAmount = labTech.carry[BOOST_COMPONENTS[boost][key]] || 0;
                if (storageAmount + terminalAmount + techAmount < 500) continue boost;
            }
            let alreadyCreating = _.filter(room.structures, (s) => s.structureType === STRUCTURE_LAB && s.memory.active && s.memory.creating === boost)[0];
            let outputLab = _.filter(room.structures, (s) => s.structureType === STRUCTURE_LAB && s.mineralType === boost);
            let fresh = 0;
            if (outputLab[0]) fresh = outputLab[0].mineralAmount;
            let terminalAmount = terminal.store[boost] || 0;
            let storageAmount = storage.store[boost] || 0;
            if (terminalAmount + storageAmount + fresh >= BOOST_AMOUNT || alreadyCreating) continue;
            let componentOne = BOOST_COMPONENTS[boost][0];
            let componentTwo = BOOST_COMPONENTS[boost][1];
            room.memory.activeReaction = boost;
            let hub = availableLabs.pos.findInRange(room.structures, 3, {filter: (s) => s.structureType === STRUCTURE_LAB && !s.memory.active});
            for (let labID in hub) {
                let one = _.filter(hub, (h) => h.memory.itemNeeded === componentOne)[0];
                let two = _.filter(hub, (h) => h.memory.itemNeeded === componentTwo)[0];
                if (!one) {
                    hub[labID].memory = {
                        itemNeeded: componentOne,
                        creating: boost,
                        room: hub[labID].pos.roomName,
                        id: hub[labID].id,
                        active: true
                    };
                } else if (!two) {
                    hub[labID].memory = {
                        itemNeeded: componentTwo,
                        creating: boost,
                        room: hub[labID].pos.roomName,
                        id: hub[labID].id,
                        active: true
                    };
                } else {
                    hub[labID].memory = {
                        creating: boost,
                        room: hub[labID].pos.roomName,
                        id: hub[labID].id,
                        active: true
                    };
                    log.a(room.name + ' queued ' + boost + ' for creation.');
                    break boost;
                }
            }
        }
}

function manageActiveLabs() {
    let activeLabs = _.filter(Game.structures, (s) => s.room.memory.reactionRoom && s.structureType === STRUCTURE_LAB && s.memory.active && !s.memory.itemNeeded && !s.memory.neededBoost && !s.cooldown);
    if (activeLabs.length) {
        active:
            for (let key in activeLabs) {
                let outputLab = activeLabs[key];
                let hub = _.filter(outputLab.room.structures, (s) => s.structureType === STRUCTURE_LAB && s.memory.active && s.memory.creating === outputLab.memory.creating);
                let creators = _.pluck(_.filter(hub, (l) => l.memory.itemNeeded), 'id');
                if (!outputLab) {
                    for (let id in hub) {
                        hub[id].memory = undefined;
                    }
                    continue;
                }
                if (outputLab.memory.creating) {
                    outputLab.room.visual.text(
                        ICONS.reaction + ' ' + outputLab.memory.creating,
                        outputLab.pos.x,
                        outputLab.pos.y,
                        {align: 'left', opacity: 0.8}
                    );
                }
                //Check for range issues
                let rangeOne;
                let rangeTwo;
                let creatorOne = Game.getObjectById(creators[0]);
                let creatorTwo = Game.getObjectById(creators[1]);
                if (creatorOne) rangeOne = creatorOne.pos.getRangeTo(outputLab);
                if (creatorTwo) rangeTwo = creatorTwo.pos.getRangeTo(outputLab);
                if (rangeOne > 3 || rangeTwo > 3 || !rangeOne || !rangeTwo) {
                    log.a(outputLab.room.name + ' is no longer producing ' + outputLab.memory.creating + ' due to a range issue.');
                    let resetLabs = _.filter(outputLab.room.structures, (s) => s.memory && s.memory.creating === outputLab.memory.creating);
                    if (resetLabs.length) {
                        for (let id in resetLabs) {
                            resetLabs[id].memory = undefined;
                    }
                    continue;
                }
                }
                // Enough created
                let total = getBoostAmount(outputLab.room, outputLab.memory.creating);
                if ((!_.includes(TIER_2_BOOSTS, outputLab.memory.creating) || !_.includes(END_GAME_BOOSTS, outputLab.memory.creating)) && total >= BOOST_AMOUNT * 2.5) {
                    log.a(outputLab.room.name + ' is no longer producing ' + outputLab.memory.creating + ' due to hitting the production cap.');
                    let resetLabs = _.filter(outputLab.room.structures, (s) => s.memory && s.memory.creating === outputLab.memory.creating);
                    if (resetLabs.length) {
                        for (let id in resetLabs) {
                            resetLabs[id].memory = undefined;
                    }
                    continue;
                }
                }
                // Input shortage
                for (let id in creators) {
                    let lab = Game.getObjectById(creators[id]);
                    let total = getBoostAmount(lab.room, lab.memory.itemNeeded);
                    if (total < 100) {
                        log.a(outputLab.room.name + ' is no longer producing ' + outputLab.memory.creating + ' due to a shortage of ' + lab.memory.itemNeeded + '.');
                        let resetLabs = _.filter(outputLab.room.structures, (s) => s.memory && s.memory.creating === outputLab.memory.creating);
                        if (resetLabs.length) {
                            for (let id in resetLabs) {
                                resetLabs[id].memory = undefined;
                        }
                        continue active;
                    }
                }
                }
                if (outputLab.memory.creating) outputLab.runReaction(Game.getObjectById(creators[0]), Game.getObjectById(creators[1]));
            }
    }
}

function getBoostAmount(room, boost) {
    let boostInRoomStructures = _.sum(room.lookForAtArea(LOOK_STRUCTURES, 0, 0, 49, 49, true), (s) => {
        if (s['structure'] && s['structure'].store) {
            return s['structure'].store[boost] || 0;
        } else if (s['structure'] && s['structure'].mineralType === boost) {
            return s['structure'].mineralAmount || 0;
        } else {
            return 0;
        }
    });
    let boostInRoomCreeps = _.sum(room.lookForAtArea(LOOK_CREEPS, 0, 0, 49, 49, true), (s) => {
        if (s['creep'] && s['creep'].carry) {
            return s['creep'].carry[boost] || 0;
        } else {
            return 0;
        }
    });
    return boostInRoomCreeps + boostInRoomStructures;
}