package com.codingame.view;

import com.codingame.game.Building;

public class BuildingDto {
    public int id;
    public int buildingType;
    public int x, y;
    //TODO: remove and handle with events
    public boolean hasTeleporter;

    public BuildingDto(Building b) {
        this.id = b.id;
        this.buildingType = b.buildingType;
        this.x = b.x;
        this.y = b.y;
    }
}
