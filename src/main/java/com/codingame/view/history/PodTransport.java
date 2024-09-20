package com.codingame.view.history;

import java.util.ArrayList;
import java.util.List;

import com.codingame.game.Building;
import com.codingame.game.City;

public class PodTransport {

    public int fromId, toId;
    public List<Integer> workers;
    public double distance;

    public PodTransport(Building from, Building to) {
        this.fromId = from.id;
        this.toId = to.id;
        this.workers = new ArrayList<>();
        this.distance = City.euclideanDist(from, to);
    }

    public void add(int workType) {
        workers.add(workType);

    }

}
