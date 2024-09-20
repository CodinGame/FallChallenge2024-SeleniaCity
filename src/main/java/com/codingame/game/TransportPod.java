package com.codingame.game;

import java.util.ArrayList;

public class TransportPod implements Comparable<TransportPod> {
    public int id;
    public ArrayList<Building> route;
    public int currentIndex;
    public int remainingCapacity;

    public TransportPod(int id, ArrayList<Building> route) {
        this.id = id;
        if (route.size() > Constants.DAYS_PER_MONTH) {
        	this.route = new ArrayList<>(route.subList(0, Constants.DAYS_PER_MONTH + 1)); // Trim to remove unreachable stops
        } else {
        	this.route = route;
        }
        currentIndex = 0;
        remainingCapacity = Constants.POD_CAPACITY;
    }

    public Building getCurrentBuilding() {
        if (currentIndex >= 0 && currentIndex < route.size()) {
            return route.get(currentIndex);
        } else {
            return null;
        }
    }

    public Building getNextBuilding() {
        if (currentIndex + 1 >= 0 && currentIndex + 1 < route.size()) {
            return route.get(currentIndex + 1);
        } else {
            return null;
        }
    }
    
    public void moveToNextBuilding() {
    	currentIndex++;
    	if (currentIndex == route.size() - 1 && route.get(0) == route.get(route.size() - 1)) {
    		currentIndex = 0; // Reset cycle if the route is a loop
    	}
    }

    public void resetCapacity() {
        remainingCapacity = Constants.POD_CAPACITY;
    }

    public void resetPosition() {
        currentIndex = 0;
    }
    
    public String formatString() {
    	StringBuilder sb = new StringBuilder();
    	sb.append(id).append(" ").append(route.size());
    	for (Building b : route) {
    		sb.append(" ").append(b.id);
    	}
    	return sb.toString();
    }

    @Override
    public int compareTo(TransportPod other) {
        return Integer.compare(this.id, other.id);
    }
}