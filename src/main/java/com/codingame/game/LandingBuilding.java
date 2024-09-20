package com.codingame.game;

import java.util.ArrayList;

public class LandingBuilding extends Building {
    public ArrayList<Integer> astronautTypes;

    public LandingBuilding(int id, int x, int y, ArrayList<Integer> astronautTypes) {
        super(id, x, y);
        this.astronautTypes = astronautTypes;
        this.buildingType = Constants.LANDING_BUILDING_TYPE;
    }

    public String formatString() {
        StringBuilder sb = new StringBuilder();
        sb.append(buildingType).append(" ").append(id).append(" ").append(x).append(" ").append(y).append(" ").append(astronautTypes.size());
        for (Integer type : astronautTypes) {
            sb.append(" ").append(type);
        }
        return sb.toString();
    }
}