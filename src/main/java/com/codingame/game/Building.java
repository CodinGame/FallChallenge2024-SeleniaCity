package com.codingame.game;

public abstract class Building implements Comparable<Building> {
    public int id;
    public int x, y;
    public int remainingTubeSlots;
    public boolean hasTeleporter;
    public int buildingType;

    public Building(int id, int x, int y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.remainingTubeSlots = Constants.MAX_TUBES_PER_BUILDING;
        this.hasTeleporter = false;
    }

    public abstract String formatString();

    @Override
    public int hashCode() {
        return id;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj == null || getClass() != obj.getClass()) {
            return false;
        }
        Building other = (Building) obj;
        return this.id == other.id;
    }
    
    @Override
    public int compareTo(Building other) {
        return Integer.compare(this.id, other.id);
    }
}