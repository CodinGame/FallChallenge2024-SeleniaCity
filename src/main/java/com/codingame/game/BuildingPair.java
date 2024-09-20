package com.codingame.game;

import java.util.Objects;

public class BuildingPair {
    public Building building1, building2;

    public BuildingPair(Building building1, Building building2) {
        this.building1 = building1;
        this.building2 = building2;
    }

    @Override
    public int hashCode() {
        return Objects.hash(building1, building2);
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj == null || getClass() != obj.getClass()) {
            return false;
        }
        BuildingPair bp = (BuildingPair) obj;
        return (this.building1 == bp.building1 && this.building2 == bp.building2);
    }
}