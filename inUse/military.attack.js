/**
 * Created by Bob on 7/4/2017.
 */
const profiler = require('screeps-profiler');

function controller() {
    cacheAttacks();
    clearAttacks();
    getIntel();
    queueTroops();
}
module.exports.controller = profiler.registerFN(controller, 'attackController');


//Cache attack requests
function cacheAttacks() {
    for (let name in Game.flags) {
        if (_.startsWith(name, 'attack')) {
            let cache = Memory.warControl || {};
            let tick = Game.time;
            cache[Game.flags[name].pos.roomName] = {
                tick: tick
            };
            Memory.warControl = cache;
            Game.flags[name].remove();
        }
    }
}


//Clear attack requests
function clearAttacks() {
    for (let name in Game.flags) {
        if (_.startsWith(name, 'cancel')) {
            Memory.warControl[Game.flags[name].pos.roomName] = undefined;
            Memory.militaryNeeds[Game.flags[name].pos.roomName] = undefined;
            Game.flags[name].remove();
        }
    }
}


//Gather intel if needed
function getIntel() {
    for (let key in Memory.warControl) {
        //check if scouted
        if (Memory.roomCache[key] && Memory.roomCache[key].cached + 300 < Game.time) {
            //check if room is owned
            if (Memory.roomCache[key].owner) {
                Memory.warControl[key].type = 'siege';
                if (Memory.roomCache[key].towers === 0 || undefined) {
                    Memory.warControl[key].level = 1;
                } else if (Memory.roomCache[key].towers === 1) {
                    Memory.warControl[key].level = 2;
                } else if (Memory.roomCache[key].towers === 2) {
                    Memory.warControl[key].level = 3;
                } else if (Memory.roomCache[key].towers === 3) {
                    Memory.warControl[key].level = 4;
                }
            } else {
                Memory.warControl[key].type = 'raid';
            }
        } else {
            Memory.warControl[key].type = 'scout';
        }
    }
}


//Queue build request
function queueTroops() {
    for (let key in Memory.warControl) {
        let cache = Memory.militaryNeeds || {};
        if (Memory.warControl[key].type === 'scout') {
            cache[key] = {
                scout: 1,
                attacker: 0,
                healer: 0,
                deconstructor: 0,
                ranged: 0
            };
            Memory.militaryNeeds = cache;
        } else if (Memory.warControl[key].type === 'raid') {
            cache[key] = {
                attacker: 0,
                healer: 0,
                deconstructor: 0,
                ranged: 1
            };
            Memory.militaryNeeds = cache;
        } else if (Memory.warControl[key].type === 'siege') {
            if (Memory.warControl[key].level === 1) {
                cache[key] = {
                    attacker: 1,
                    healer: 1,
                    deconstructor: 1,
                    ranged: 0
                };
                Memory.militaryNeeds = cache;
            } else if (Memory.warControl[key].level === 2) {
                cache[key] = {
                    attacker: 1,
                    healer: 1,
                    deconstructor: 2,
                    ranged: 1
                };
                Memory.militaryNeeds = cache;
            } else if (Memory.warControl[key].level === 3) {
                cache[key] = {
                    attacker: 2,
                    healer: 2,
                    deconstructor: 2,
                    ranged: 3
                };
                Memory.militaryNeeds = cache;
            } else if (Memory.warControl[key].level === 4) {
                cache[key] = {
                    attacker: 2,
                    healer: 3,
                    deconstructor: 4,
                    ranged: 4
                };
                Memory.militaryNeeds = cache;
            }
        }
    }
}