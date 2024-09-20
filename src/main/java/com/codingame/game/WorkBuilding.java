package com.codingame.game;

public class WorkBuilding extends Building {

    public WorkBuilding(int id, int x, int y, int buildingType) {
        super(id, x, y);
        this.buildingType = buildingType;
    }

    public String formatString() {
        return buildingType + " " + id + " " + x + " " + y;
    }
}