package com.codingame.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Queue;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.codingame.event.Animation;
import com.codingame.event.EventData;
import com.codingame.view.history.FromTo;
import com.codingame.view.history.PodTransport;
import com.codingame.view.history.TeleportTransport;

public class TravelManager {
    public City city;
    public HashSet<Astronaut> astronauts;
    HashMap<Building, HashMap<Integer, Integer>> precomputedClosestTypes;
    HashMap<Building, Integer> numAstronautsAllocated;
    Animation animation;

    public TravelManager(City city, Animation animation) {
        this.city = city;
        this.animation = animation;
    }

    public HashMap<Building, Integer> singleSourceShortestPath(Building startBuilding) {
        // Perform BFS on a single source
        // Complexity is O(|V|) since |E| is bounded

        HashMap<Building, Integer> buildingDistance = new HashMap<Building, Integer>();
        Queue<Building> toVisit = new LinkedList<Building>();

        buildingDistance.put(startBuilding, 0);
        toVisit.add(startBuilding);

        while (!toVisit.isEmpty()) {
            Building visiting = toVisit.remove();
            int currDistance = buildingDistance.get(visiting);

            // Process teleporter first
            if (city.teleporterByBuilding.containsKey(visiting)) {
                Teleporter tp = city.teleporterByBuilding.get(visiting);
                if (tp.buildings.building1 == visiting && !buildingDistance.containsKey(tp.buildings.building2)) {
                    buildingDistance.put(tp.buildings.building2, currDistance);
                    toVisit.add(tp.buildings.building2);
                }
            }

            // Then process tubes
            if (city.tubesByBuilding.containsKey(visiting)) {
                for (Tube tube : city.tubesByBuilding.get(visiting)) {
                    Building otherBuilding;
                    if (tube.buildings.building1 == visiting) {
                        otherBuilding = tube.buildings.building2;
                    } else {
                        otherBuilding = tube.buildings.building1;
                    }

                    if (!buildingDistance.containsKey(otherBuilding)) {
                        buildingDistance.put(otherBuilding, currDistance + 1);
                        toVisit.add(otherBuilding);
                    }
                }
            }
        }
        return buildingDistance;
    }

    public HashMap<Building, HashMap<Integer, Integer>> computeClosestBuildingTypes() {
        HashMap<Building, HashMap<Integer, Integer>> closestBuildingType = new HashMap<Building, HashMap<Integer, Integer>>();

        for (Building building : city.buildings.values()) {
            HashMap<Building, Integer> distances = singleSourceShortestPath(building);
            HashMap<Integer, Integer> closestToCurrent = new HashMap<Integer, Integer>();
            for (Building otherBuilding : distances.keySet()) {
                if (!closestToCurrent.containsKey(otherBuilding.buildingType)) {
                    closestToCurrent.put(otherBuilding.buildingType, distances.get(otherBuilding));
                } else {
                    int currentClosestDist = closestToCurrent.get(otherBuilding.buildingType);
                    int otherClosestDist = distances.get(otherBuilding);
                    if (otherClosestDist < currentClosestDist) {
                        closestToCurrent.put(otherBuilding.buildingType, otherClosestDist);
                    }
                }
            }
            closestBuildingType.put(building, closestToCurrent);
        }
        return closestBuildingType;
    }

    public void newMonth() {
        // Precompute city shortest paths for astronaut navigation
        precomputedClosestTypes = computeClosestBuildingTypes();

        // Spawn all astronauts
        astronauts = new HashSet<Astronaut>();
        for (int buildingId : city.buildings.keySet()) {
            Building building = city.buildings.get(buildingId);
            if (building.buildingType == Constants.LANDING_BUILDING_TYPE) {
                List<Astronaut> arriving = new ArrayList<Astronaut>();
                LandingBuilding landingPad = (LandingBuilding) building;
                for (int i = 0; i < landingPad.astronautTypes.size(); i++) {
                    int astronautType = landingPad.astronautTypes.get(i);
                    int astronautId = Constants.ASTRONAUT_ID_MULT * building.id + i;
                    arriving.add(new Astronaut(astronautId, building, astronautType));
                }
                astronauts.addAll(arriving);
                launchArrivalEvent(landingPad, arriving);
            }
        }

        animation.catchUp();

        // Reset pods
        for (TransportPod pod : city.pods.values()) {
            pod.resetCapacity();
            pod.resetPosition();
        }

        // initialize balancing score counters
        numAstronautsAllocated = new HashMap<Building, Integer>();
        for (Building building : city.buildings.values()) {
            numAstronautsAllocated.put(building, 0);
        }
    }

    private void launchArrivalEvent(LandingBuilding landingPad, List<Astronaut> astronauts) {
        EventData e = new EventData();
        e.type = EventData.ARRIVAL;
        e.params = new int[astronauts.stream().mapToInt(a -> a.workType).max().orElse(0) + 1];
        for (Astronaut a : astronauts) {
            e.params[a.workType] += 1;
        }
        e.params[0] = landingPad.id;

        animation.startAnim(e, Animation.WHOLE * 2);

        animation.wait(Animation.TENTH);
    }

    private boolean nothingMoved;

    public boolean didNothingMove() {
        return nothingMoved;
    }

    public List<TeleportTransport> teleports = new ArrayList<>();
    public Map<Integer, PodTransport> podTransport = new HashMap<>();

    public int simulateDay(int currentDay) {
        nothingMoved = true;
        teleports.clear();
        podTransport.clear();

        int dayScore = 0;

        Objects.requireNonNull(astronauts);

        // STEP 1 : Compute astronaut travel for teleporters
        for (Astronaut astronaut : new HashSet<Astronaut>(astronauts)) { // Use a copy so we can delete astronauts while iterating
            Building currentBuilding = astronaut.currentBuilding;
            Teleporter tp = city.teleporterByBuilding.get(currentBuilding);
            if (tp != null && tp.buildings.building1 == currentBuilding) {
                Building otherBuilding = tp.buildings.building2;
                Integer currentDistance = precomputedClosestTypes.get(currentBuilding).get(astronaut.workType);
                Integer tpDistance = precomputedClosestTypes.get(otherBuilding).get(astronaut.workType);
                if (currentDistance == null && tpDistance != null || tpDistance != null && tpDistance <= currentDistance) {
                    astronaut.currentBuilding = otherBuilding;
                    teleports.add(new TeleportTransport(astronaut.workType, tp.buildings));
                    nothingMoved = false;

                    if (astronaut.currentBuilding.buildingType == astronaut.workType) {
                        // Astronaut has reached their destination :)
                        // Speed score
                        dayScore += Constants.MAX_SPEED_POINTS - currentDay;
                        // Diversity score
                        int astronautsAlreadyAllocated = numAstronautsAllocated.get(astronaut.currentBuilding);
                        numAstronautsAllocated.put(astronaut.currentBuilding, astronautsAlreadyAllocated + 1);
                        if (Constants.MAX_DIVERSITY_POINTS - astronautsAlreadyAllocated > 0) {
                            dayScore += Constants.MAX_DIVERSITY_POINTS - astronautsAlreadyAllocated;
                        }
                        astronauts.remove(astronaut);
                    }
                }
            }
        }

        Map<Integer, List<Integer>> teleportingAstronautsByBuilding = teleports.stream()
            .collect(
                Collectors.groupingBy(
                    tp -> tp.fromId,
                    Collectors.mapping(
                        tp -> tp.astronautType,
                        Collectors.toList()
                    )
                )
            );

        Map<Integer, TeleportTransport> teleportByBuilding = teleports.stream()
            .collect(Collectors.toMap(tp -> tp.fromId, Function.identity(), (existing, replacement) -> existing));

        for (Integer fromId : teleportingAstronautsByBuilding.keySet()) {
            TeleportTransport tp = teleportByBuilding.get(fromId);
            Map<Integer, Long> astronautCountByType = teleportingAstronautsByBuilding.get(fromId).stream()
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));

            EventData e = new EventData();
            e.type = EventData.TRANSPORT_TP;
            e.params = new int[4 + (astronautCountByType.size() * 2)];
            e.params[0] = tp.fromId;
            e.params[1] = tp.toId;
            int astronautCount = teleportingAstronautsByBuilding.get(fromId).size();
            // arbitrarily chose 100
            int timeBetweenTeleport = astronautCount < 100 ? Animation.TWENTIETH : Animation.HUNDREDTH;
            // arbitrarily chose 100
            double p = tp.distance / 100d;
            int tpTime = (int) (Animation.HALF * p);
            e.params[2] = timeBetweenTeleport;
            e.params[3] = tpTime;
            int idx = 4;
            for (Integer type : astronautCountByType.keySet()) {
                e.params[idx++] = type;
                e.params[idx++] = astronautCountByType.get(type).intValue();
            }
            int animationTime = (astronautCount * timeBetweenTeleport) + tpTime;
            animation.startAnim(e, animationTime);
        }

        animation.catchUp();

        // STEP 2 : Compute transport pod priority
        HashMap<Tube, ArrayList<TransportPod>> podsLeavingTubes = new HashMap<Tube, ArrayList<TransportPod>>();
        HashMap<Building, ArrayList<TransportPod>> podsLeavingBuildings = new HashMap<Building, ArrayList<TransportPod>>();

        ArrayList<TransportPod> sortedPods = new ArrayList<TransportPod>(city.pods.values());
        Collections.sort(sortedPods); // Pod ID is also the priority score
        for (TransportPod pod : sortedPods) {
            // Check if the pod has reached the end of its route
            Building currentBuilding = pod.getCurrentBuilding();
            Building nextBuilding = pod.getNextBuilding();
            if (nextBuilding != null) {
                Tube tube = city.getTubeByBuildings(currentBuilding, nextBuilding);
                if (!podsLeavingTubes.containsKey(tube)) {
                    podsLeavingTubes.put(tube, new ArrayList<TransportPod>());
                }
                if (podsLeavingTubes.get(tube).size() < tube.capacity) {
                    // The tube is free, send the pod through it
                    podsLeavingTubes.get(tube).add(pod);
                    if (!podsLeavingBuildings.containsKey(currentBuilding)) {
                        podsLeavingBuildings.put(currentBuilding, new ArrayList<TransportPod>());
                    }
                    podsLeavingBuildings.get(currentBuilding).add(pod);
                    pod.resetCapacity();
                    pod.moveToNextBuilding();
                    nothingMoved = false;

                    podTransport.put(pod.id, new PodTransport(currentBuilding, nextBuilding));
                }
            }
        }

        // STEP 3 : Move astronauts in tubes
        List<Astronaut> sortedAstronauts = astronauts.stream().sorted().toList();
        for (Astronaut astronaut : sortedAstronauts) {
            Building currentBuilding = astronaut.currentBuilding;
            if (!podsLeavingBuildings.containsKey(currentBuilding)) {
                // No pods leaving current building, skip.
                continue;
            }
            if (!precomputedClosestTypes.get(currentBuilding).containsKey(astronaut.workType)) {
                // No path to destination, skip.
                continue;
            }
            for (TransportPod pod : podsLeavingBuildings.get(currentBuilding)) {
                // podsLeavingBuildings contains lists sorted by pod id, no need to sort again
                Building nextBuilding = pod.getCurrentBuilding(); // not getNextBuilding because pod has already moved in step 2
                if (
                    pod.remainingCapacity > 0
                        && precomputedClosestTypes.get(nextBuilding).get(astronaut.workType) < precomputedClosestTypes.get(currentBuilding)
                            .get(astronaut.workType)
                ) {
                    // Pod has a free seat and brings closer to the destination
                    pod.remainingCapacity--;
                    astronaut.currentBuilding = nextBuilding;
                    podTransport.get(pod.id).add(astronaut.workType);

                    if (astronaut.currentBuilding.buildingType == astronaut.workType) {
                        // Astronaut has reached their destination :)
                        // Speed score
                        dayScore += Constants.MAX_SPEED_POINTS - (currentDay + 1); // currentDay + 1 because travel took the entire day
                        // Diversity score
                        int astronautsAlreadyAllocated = numAstronautsAllocated.get(astronaut.currentBuilding);
                        numAstronautsAllocated.put(astronaut.currentBuilding, astronautsAlreadyAllocated + 1);
                        if (Constants.MAX_DIVERSITY_POINTS - astronautsAlreadyAllocated > 0) {
                            dayScore += Constants.MAX_DIVERSITY_POINTS - astronautsAlreadyAllocated;
                        }
                        astronauts.remove(astronaut);
                    }
                    break;
                }
            }

        }

        Map<FromTo, Integer> podLaunchCounter = new HashMap<>();
        Map<FromTo, Integer> podTotalByIds = new HashMap<>();

        podTransport.values().stream()
            .forEach(p -> {
                FromTo ft = new FromTo(p);
                podTotalByIds.compute(ft, (k, v) -> v == null ? 1 : v + 1);
                podLaunchCounter.put(ft, 0);
            });

        int frameTimeBeforePods = animation.getFrameTime();

        podTransport.forEach((podId, transport) -> {
            EventData e = new EventData();
            e.type = EventData.TRANSPORT_POD;
            e.podTransport = transport;
            Collections.sort(transport.workers);

            e.params = new int[3];
            e.params[0] = transport.fromId;
            e.params[1] = transport.toId;
            e.params[2] = podId;

            double p = transport.distance / 50d;
            int animDuration = (int) (Animation.HALF * p);
            animation.setFrameTime(frameTimeBeforePods);

            FromTo ft = new FromTo(transport);
            int podIdx = podLaunchCounter.get(ft);
            double podCount = podTotalByIds.get(ft);

            animation.wait((int) (podIdx * (animDuration / podCount)));

            animation.startAnim(e, animDuration);
            podLaunchCounter.compute(ft, (k, v) -> v + 1);
        });
        animation.setFrameTime(frameTimeBeforePods);
        return dayScore;
    }
}