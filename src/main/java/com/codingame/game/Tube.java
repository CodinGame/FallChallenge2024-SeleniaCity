package com.codingame.game;

public class Tube {
    public BuildingPair buildings;
    public int capacity;

    public Tube(Building building1, Building building2) {
        buildings = new BuildingPair(building1, building2);
        this.capacity = 1;
    }
}