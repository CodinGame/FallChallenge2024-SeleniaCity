package com.codingame.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.TreeMap;

public class City {
    public TreeMap<Integer, TransportPod> pods;

    public HashMap<BuildingPair, Tube> tubes;
    public HashMap<Building, ArrayList<Tube>> tubesByBuilding;

    public HashMap<BuildingPair, Teleporter> teleporters;
    public HashMap<Building, Teleporter> teleporterByBuilding;

    public TreeMap<Integer, Building> buildings;
    public int resources;
    public int maxY;

    public City() {
        pods = new TreeMap<Integer, TransportPod>();
        tubes = new HashMap<BuildingPair, Tube>();
        tubesByBuilding = new HashMap<Building, ArrayList<Tube>>();
        teleporters = new HashMap<BuildingPair, Teleporter>();
        teleporterByBuilding = new HashMap<Building, Teleporter>();
        buildings = new TreeMap<Integer, Building>();
        resources = 0;
        maxY = 0;
    }

    public void createTeleporter(int buildingId1, int buildingId2) {
        Building building1 = getBuildingById(buildingId1);
        if (building1 == null) {
            throw new GameWarning("Warning: could not create teleporter, building " + buildingId1 + " does not exist.");
        }
        if (building1.hasTeleporter) {
            throw new GameWarning("Warning: could not create teleporter, building " + buildingId1 + " already has a teleporter entrance or exit.");
        }

        Building building2 = getBuildingById(buildingId2);
        if (building2 == null) {
            throw new GameWarning("Warning: could not create teleporter, building " + buildingId2 + " does not exist.");
        }
        if (building2.hasTeleporter) {
            throw new GameWarning("Warning: could not create teleporter, building " + buildingId2 + " already has a teleporter entrance or exit.");
        }
        
        if (building1 == building2) {
            throw new GameWarning("Warning: could not create teleporter, trying to connect " + buildingId1 + " to itself.");
        }

        if (resources < Constants.TELEPORTER_COST) {
            throw new GameWarning(
                "Warning: could not create teleporter between buildings " + buildingId1 + " and " + buildingId2 + ", not enough resources."
            );
        }

        BuildingPair bp = new BuildingPair(building1, building2);
        Teleporter teleporter = new Teleporter(bp);
        teleporters.put(bp, teleporter);
        teleporterByBuilding.put(building1, teleporter);
        teleporterByBuilding.put(building2, teleporter);

        building1.hasTeleporter = true;
        building2.hasTeleporter = true;

        resources -= Constants.TELEPORTER_COST;
    }

    public void createTube(int buildingId1, int buildingId2) {
        Building building1 = getBuildingById(buildingId1);
        if (building1 == null) {
            throw new GameWarning("Warning: could not create tube, building " + buildingId1 + " does not exist.");
        }

        Building building2 = getBuildingById(buildingId2);
        if (building2 == null) {
            throw new GameWarning("Warning: could not create tube, building " + buildingId2 + " does not exist.");
        }

        if (building1 == building2) {
            throw new GameWarning("Warning: could not create tube, trying to connect building " + buildingId1 + " to itself.");
        }

        Tube duplicateTube = getTubeByBuildings(building1, building2);
        if (duplicateTube != null) {
            throw new GameWarning(
                "Warning: could not create tube, a tube already exists between buildings " + buildingId1 + " and " + buildingId2 + "."
            );
        }

        if (building1.remainingTubeSlots <= 0) {
            throw new GameWarning("Warning: could not create tube, building " + buildingId1 + " already has the maximum number of tubes.");
        }

        if (building2.remainingTubeSlots <= 0) {
            throw new GameWarning("Warning: could not create tube, building " + buildingId2 + " already has the maximum number of tubes.");
        }

        int buildCost = getTubeBaseCost(building1, building2);
        if (resources < buildCost) {
            throw new GameWarning(
                "Warning: could not create tube, not enough resources (you only have " + resources + " but need " + buildCost + ")."
            );
        }

        Tube createdTube = new Tube(building1, building2);

        // check that no buildings are exactly on the tube path
        for (Building building : buildings.values()) {
            if (building != building1 && building != building2 && doesBuildingIntersectTube(building, createdTube)) {
                throw new GameWarning(
                    "Warning: could not create tube between buildings " + buildingId1 + " and " + buildingId2 + ": it intersects building "
                        + building.id + "."
                );
            }
        }

        // Check all existing tubes for an intersection
        for (Tube otherTube : tubes.values()) {
            if (doTubesIntersect(createdTube, otherTube)) {
                throw new GameWarning(
                    "Warning: could not create tube between buildings " + buildingId1 + " and " + buildingId2
                        + ": it intersects the existing tube between buildings " + otherTube.buildings.building1.id + " and "
                        + otherTube.buildings.building2.id + "."
                );
            }
        }

        resources -= buildCost;
        building1.remainingTubeSlots--;
        building2.remainingTubeSlots--;

        BuildingPair bp = new BuildingPair(building1, building2);
        tubes.put(bp, createdTube);

        if (!tubesByBuilding.containsKey(building1)) {
            tubesByBuilding.put(building1, new ArrayList<Tube>());
        }
        tubesByBuilding.get(building1).add(createdTube);

        if (!tubesByBuilding.containsKey(building2)) {
            tubesByBuilding.put(building2, new ArrayList<Tube>());
        }
        tubesByBuilding.get(building2).add(createdTube);
    }

    public void upgradeTube(int buildingId1, int buildingId2) {
        Tube tube = getTubeByBuildingIds(buildingId1, buildingId2);
        if (tube == null) {
            throw new GameWarning(
                "Warning: could not upgrade tube, there is no existing tube between buildings " + buildingId1 + " and " + buildingId2 + "."
            );
        }
        int upgradeCost = (tube.capacity + 1) * getTubeBaseCost(tube.buildings.building1, tube.buildings.building2);

        if (resources < upgradeCost) {
            throw new GameWarning(
                "Warning: could not upgrade tube, not enough resources (you only have " + resources + " but need " + upgradeCost + ")."
            );
        }
        resources -= upgradeCost;
        tube.capacity++;
    }

    public void createPod(int id, ArrayList<Integer> buildingIds) {
        if (pods.containsKey(id)) {
            throw new GameWarning(
                "Warning: could not create pod, another pod with id " + id + " already exists. Destroy it first or use another id."
            );
        }
        
        if (id < 0 || id > Constants.MAX_POD_ID) {
        	throw new GameWarning(
                "Warning: could not create pod, the id must be between 0 and " + Constants.MAX_POD_ID + "."
            );
        }

        ArrayList<Building> route = new ArrayList<Building>();
        for (int buildingId : buildingIds) {
            Building building = getBuildingById(buildingId);
            if (building == null) {
                throw new GameWarning("Warning: could not create pod, building " + buildingId + " does not exist.");
            }
            route.add(building);
        }

        for (int i = 0; i < buildingIds.size() - 1; i++) {
            if (getTubeByBuildingIds(buildingIds.get(i), buildingIds.get(i + 1)) == null) {
                throw new GameWarning(
                    "Warning: could not create pod, there is no tube between buildings " + buildingIds.get(i) + " and " + buildingIds.get(i + 1)
                );
            }
        }

        if (resources < Constants.POD_COST) {
            throw new GameWarning("Warning: could not create pod with id " + id + " , not enough resources.");
        }

        resources -= Constants.POD_COST;
        TransportPod pod = new TransportPod(id, route);
        pods.put(id, pod);
    }

    public void deletePod(int id) {
        if (!pods.containsKey(id)) {
            throw new GameWarning("Warning: could not delete pod with id " + id + ", pod does not exist.");
        }
        pods.remove(id);
        resources += Constants.POD_DESTROY_VALUE;
    }

    public TransportPod getPodById(int id) {
        return pods.get(id);
    }

    public Building getBuildingById(int id) {
        return buildings.get(id);
    }

    public Tube getTubeByBuildingIds(int buildingId1, int buildingId2) {
        Building building1 = getBuildingById(buildingId1);
        Building building2 = getBuildingById(buildingId2);
        if (building1 == null || building2 == null) {
            return null;
        }
        return getTubeByBuildings(building1, building2);
    }

    public Tube getTubeByBuildings(Building building1, Building building2) {
        Tube result = tubes.get(new BuildingPair(building1, building2));
        if (result == null) {
            result = tubes.get(new BuildingPair(building2, building1)); // Search the opposite direction
        }
        return result;
    }

    public Teleporter getTeleporterByBuildingIds(int buildingId1, int buildingId2) {
        Building building1 = getBuildingById(buildingId1);
        Building building2 = getBuildingById(buildingId2);
        if (building1 == null || building2 == null) {
            return null;
        }
        return getTeleporterByBuildings(building1, building2);
    }

    public Teleporter getTeleporterByBuildings(Building building1, Building building2) {
        return teleporters.get(new BuildingPair(building1, building2)); // Teleporters are unidirectional
    }

    public static double euclideanDist(Building a, Building b) {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    public boolean doesBuildingIntersectTube(Building building, Tube tube) {
        double epsilon = 0.0000001;
        double distDiff = (euclideanDist(tube.buildings.building1, building)
            + euclideanDist(building, tube.buildings.building2)
            - euclideanDist(tube.buildings.building1, tube.buildings.building2));
        return (-epsilon < distDiff && distDiff < epsilon);
    }

    public int orientation(Building a, Building b, Building c) {
        int prod = (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
        return (int) Math.signum(prod);
    }

    public boolean doTubesIntersect(Tube t1, Tube t2) {
        boolean crossing1 = orientation(t1.buildings.building1, t1.buildings.building2, t2.buildings.building1)
            * orientation(t1.buildings.building1, t1.buildings.building2, t2.buildings.building2) < 0;
        boolean crossing2 = orientation(t2.buildings.building1, t2.buildings.building2, t1.buildings.building1)
            * orientation(t2.buildings.building1, t2.buildings.building2, t1.buildings.building2) < 0;
        return crossing1 && crossing2;
    }

    public int getTubeBaseCost(Building building1, Building building2) {
        return (int) (Math.hypot(building1.x - building2.x, building1.y - building2.y) * Constants.TUBE_COST);
    }

    public void addBuilding(Building building) {
        buildings.put(building.id, building);
        maxY = Math.max(maxY, building.y);
    }

}