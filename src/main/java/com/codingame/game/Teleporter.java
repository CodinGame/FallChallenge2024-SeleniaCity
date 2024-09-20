package com.codingame.game;

public class Teleporter {
    public BuildingPair buildings;

    public Teleporter(BuildingPair buildings) {
        this.buildings = buildings;
    }

    public Teleporter(Building building1, Building building2) {
        this.buildings = new BuildingPair(building1, building2);
    }
}