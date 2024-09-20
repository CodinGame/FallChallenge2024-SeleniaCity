package com.codingame.game;

public class Astronaut implements Comparable<Astronaut> {
    public int id;
    public int workType;
    public Building initialBuilding;
    public Building currentBuilding;

    public Astronaut(int id, Building initialBuilding, int workType) {
        this.id = id;
        this.initialBuilding = initialBuilding;
        this.currentBuilding = initialBuilding;
        this.workType = workType;
    }

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
        Astronaut other = (Astronaut) obj;
        return this.id == other.id;
    }

    @Override
    public int compareTo(Astronaut other) {
        return Integer.compare(this.id, other.id);
    }
}