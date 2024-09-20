package com.codingame.view.history;

import com.codingame.game.BuildingPair;
import com.codingame.game.City;

public class TeleportTransport {
    public int astronautType;
    public int fromId;
    public int toId;
    public double distance;

    public TeleportTransport(int astronautType, BuildingPair buildings) {
        this.astronautType = astronautType;
        this.fromId = buildings.building1.id;
        this.toId = buildings.building2.id;
        this.distance = City.euclideanDist(buildings.building1, buildings.building2);
    }

}
