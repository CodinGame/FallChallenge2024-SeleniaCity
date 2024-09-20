package com.codingame.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.codingame.event.Animation;
import com.codingame.event.EventData;
import com.codingame.gameengine.core.AbstractPlayer.TimeoutException;
import com.codingame.gameengine.core.AbstractReferee;
import com.codingame.gameengine.core.SoloGameManager;
import com.codingame.gameengine.core.Tooltip;
import com.codingame.view.ViewModule;
import com.codingame.view.history.TeleporterBuild;
import com.codingame.view.history.TubeBuild;
import com.codingame.view.history.TubeUpgrade;
import com.google.inject.Inject;

public class Referee extends AbstractReferee {
    @Inject private SoloGameManager<Player> gameManager;
    @Inject private ViewModule view;
    @Inject private Animation animation;

    private int numMonths;

    public ArrayList<ArrayList<Building>> newBuildingsPerMonth;
    private ArrayList<Integer> addedResourcesPerMonth;
    public City city;
    public TravelManager travelManager;
    public int totalScore;
    public ArrayList<Building> newBuildingsThisMonth;
    public List<Building> newBuildingsforView;
    public Integer gameRatio;
    public boolean simplifiedMode;

    @Override
    public void init() {
        view.init(this);
        gameManager.setFrameDuration(500);
        gameManager.setTurnMaxTime(500);

        newBuildingsPerMonth = new ArrayList<ArrayList<Building>>();
        addedResourcesPerMonth = new ArrayList<Integer>();
        city = new City();
        travelManager = new TravelManager(city, animation);
        totalScore = 0;

        int maxY = newBuildingsPerMonth.stream().flatMap(bpm -> bpm.stream()).mapToInt(b -> b.y).max().orElse(0);
        city.maxY = maxY;

        int buildingIdIncrementer = 0;

        int fileLinePtr = 0;
        String line = gameManager.getTestCaseInput().get(fileLinePtr);
        gameRatio = null;
        if (line.startsWith("x")) {
            gameRatio = Integer.valueOf(line.substring(1));
            fileLinePtr++;
            line = gameManager.getTestCaseInput().get(fileLinePtr);
        }

        simplifiedMode = false;
        if (line.startsWith("simplified")) {
            simplifiedMode = true;
            fileLinePtr++;
            line = gameManager.getTestCaseInput().get(fileLinePtr);
        }

        numMonths = Integer.valueOf(gameManager.getTestCaseInput().get(fileLinePtr++));
        gameManager.setMaxTurns(numMonths * Constants.DAYS_PER_MONTH + 1);

        for (int month = 0; month < numMonths; month++) {
            String[] monthInitData = gameManager.getTestCaseInput().get(fileLinePtr).split(" ");
            fileLinePtr++;

            int numBuildingsBuilt = Integer.parseInt(monthInitData[0]);
            int newResources = Integer.parseInt(monthInitData[1]);
            addedResourcesPerMonth.add(newResources);
            ArrayList<Building> newBuildingsThisMonth = new ArrayList<Building>();
            for (int i = 0; i < numBuildingsBuilt; i++) {
                String[] buildingData = gameManager.getTestCaseInput().get(fileLinePtr).split(" ");
                fileLinePtr++;
                int buildingType = Integer.parseInt(buildingData[0]);
                int x = Integer.parseInt(buildingData[1]);
                int y = Integer.parseInt(buildingData[2]);
                if (buildingType == Constants.LANDING_BUILDING_TYPE) {
                    String[] astronautTypeData = gameManager.getTestCaseInput().get(fileLinePtr).split(" ");
                    fileLinePtr++;
                    ArrayList<Integer> astronautTypes = new ArrayList<Integer>();
                    for (String astronautType : astronautTypeData) {
                        astronautTypes.add(Integer.parseInt(astronautType));
                    }
                    Building newBuilding = new LandingBuilding(buildingIdIncrementer, x, y, astronautTypes);
                    newBuildingsThisMonth.add(newBuilding);
                    buildingIdIncrementer++;
                } else {
                    Building newBuilding = new WorkBuilding(buildingIdIncrementer, x, y, buildingType);
                    newBuildingsThisMonth.add(newBuilding);
                    buildingIdIncrementer++;
                }
            }
            newBuildingsPerMonth.add(newBuildingsThisMonth);
        }

        newBuildingsThisMonth = newBuildingsPerMonth.get(0);
        newBuildingsforView = new ArrayList<>(newBuildingsPerMonth.get(0));
        for (Building building : newBuildingsforView) {
            city.addBuilding(building);
        }

        int newResourcesThisMonth = addedResourcesPerMonth.get(0);
        city.resources += newResourcesThisMonth;
        astronautsWereEmpty = false;
    }

    private boolean newMonth = true;
    private boolean newMonthFrame = false;

    private int monthScore = 0;
    private int currentDay = 0;
    public int currentMonth = 0;
    public int turn = 0;
    private boolean astronautsWereEmpty;

    @Override
    public void gameTurn(int turn) {
        animation.reset();
        newBuildingsforView.clear();

        this.turn = turn;
        newMonthFrame = newMonth;
        if (newMonthFrame) {
            newBuildingsforView.addAll(newBuildingsThisMonth);
            if (turn == 1) {
                newBuildingsforView.removeAll(newBuildingsPerMonth.get(0));
            }
        }

        if (newMonth) {
            astronautsWereEmpty = false;
            newMonth = false;

            currentMonth++;
            gameManager.addTooltip(new Tooltip(0, "Month " + currentMonth));

            monthScore = 0;
            currentDay = 0;

            // Resources get updated at the end of the previous month
            gameManager.getPlayer().sendInputLine(String.valueOf(city.resources));

            gameManager.getPlayer().sendInputLine(String.valueOf(city.tubes.size() + city.teleporters.size()));
            for (Teleporter tp : city.teleporters.values()) {
                gameManager.getPlayer().sendInputLine(tp.buildings.building1.id + " " + tp.buildings.building2.id + " 0");
            }
            for (Tube tube : city.tubes.values()) {
                gameManager.getPlayer().sendInputLine(tube.buildings.building1.id + " " + tube.buildings.building2.id + " " + tube.capacity);
            }

            gameManager.getPlayer().sendInputLine(String.valueOf(city.pods.size()));
            for (TransportPod pod : city.pods.values()) {
                gameManager.getPlayer().sendInputLine(pod.formatString());
            }

            gameManager.getPlayer().sendInputLine(String.valueOf(newBuildingsThisMonth.size()));
            for (Building building : newBuildingsThisMonth) {
                city.addBuilding(building);
                gameManager.getPlayer().sendInputLine(building.formatString());
            }

            gameManager.getPlayer().execute();

            launchBuildingEvents(newBuildingsforView);
            animation.catchUp();

            try {
                List<String> outputs = gameManager.getPlayer().getOutputs();
                if (outputs.size() != 1) {
                    gameManager.loseGame("You did not send 1 output line during your turn.");
                    return;
                }

                String outputLine = outputs.get(0);
                if (outputLine.equals("")) {
                    gameManager.loseGame("Your code sent an empty line. Please use a WAIT action if you don't want to make any actions this turn.");
                    return;
                }
                //For animation
                List<TubeBuild> tubeBuilds = new ArrayList<>();
                List<TubeUpgrade> tubeUpgrades = new ArrayList<>();
                List<TeleporterBuild> teleporterBuilds = new ArrayList<>();
                int nWarnings = 0;

                for (String rawAction : outputLine.split(";")) {
                    String strippedAction = rawAction.trim();
                    try {
                        boolean actionValid = processAction(strippedAction, tubeBuilds, tubeUpgrades, teleporterBuilds);
                        if (!actionValid) {
                            return;
                        }
                    } catch (GameWarning e) {
                        // Syntax is correct, but the operation cannot be performed (for various reasons).
                        // The action is ignored but a warning is displayed in the game summary.
                        nWarnings++;
                        if (nWarnings <= Constants.MAX_WARNINGS_DISPLAYED) {
                            gameManager.addToGameSummary(e.getMessage());
                        }
                    }
                }

                if (nWarnings == Constants.MAX_WARNINGS_DISPLAYED + 1) {
                    gameManager.addToGameSummary("... and 1 other warning not displayed.");
                } else if (nWarnings > Constants.MAX_WARNINGS_DISPLAYED + 1) {
                    gameManager.addToGameSummary("... and " + (nWarnings - Constants.MAX_WARNINGS_DISPLAYED) + " other warnings not displayed.");
                }

                launchNewTeleporterEvents(teleporterBuilds);
                animation.catchUp();
                launchBuildEvents(tubeBuilds);
                animation.catchUp();
                launchUpgradeEvents(tubeUpgrades);
                animation.catchUp();

            } catch (TimeoutException e) {
            	if (totalScore > 0) {
            		gameManager.winGame("Your code timed out, but the score before timeout is still counted. Your final score is " + totalScore);
            	} else {
            		gameManager.loseGame("Timeout!");
            	}
            }

            travelManager.newMonth();

        }

        monthScore += travelManager.simulateDay(currentDay);
        currentDay++;
        if (travelManager.didNothingMove() || astronautsWereEmpty) {
            newMonth = true;
        }
        astronautsWereEmpty = travelManager.astronauts.isEmpty();

        if (currentDay >= Constants.DAYS_PER_MONTH) {
            newMonth = true;
        }

        // End of month
        if (newMonth) {
            totalScore += monthScore;

            if (currentMonth >= numMonths) {
                if (totalScore > 0) {
                	gameManager.winGame("Congratulations! Your final score is " + totalScore);
                } else {
                	gameManager.loseGame("Your solution did not score any points.");
                }
            } else {
                city.resources = city.resources * Constants.RESOURCE_INTEREST_PERCENTAGE / 100;
                int newResourcesThisMonth = addedResourcesPerMonth.get(currentMonth);
                newBuildingsThisMonth = newBuildingsPerMonth.get(currentMonth);
                city.resources += newResourcesThisMonth;
            }
        }

        computeEvents();
    }

    private void computeEvents() {
        int minTime = simplifiedMode ? 100 : 500;

        animation.catchUp();

        int frameTime = Math.max(
            animation.getFrameTime(),
            minTime
        );

        if (simplifiedMode) {
            int lastNotSkippedEventEnd = 0;
            for (EventData event : getViewerEvents()) {
                if (!Constants.SIMPLIFIED_SKIPPED_EVENTS.contains(event.type) && event.animData.end > lastNotSkippedEventEnd) {
                    lastNotSkippedEventEnd = event.animData.end;
                }
            }
            frameTime = Math.max(
                lastNotSkippedEventEnd,
                minTime
            );
        }

        gameManager.setFrameDuration(frameTime);

    }

    public List<EventData> getViewerEvents() {
        return animation.getViewerEvents();
    }

    @Override
    public void onEnd() {
        gameManager.putMetadata("points", totalScore);
    }

    private boolean processAction(String action, List<TubeBuild> tubeBuilds, List<TubeUpgrade> tubeUpgrades, List<TeleporterBuild> teleporterBuilds) {
        String[] actionArray = action.split(" ");
        if (actionArray[0].equals(Constants.TUBE_ACTION)) {
            if (actionArray.length != 3) {
                gameManager.loseGame("Invalid format: expected " + Constants.TUBE_ACTION + " [buildingId1] [buildingId2], but received " + action);
                return false;
            }

            try {
                int buildingId1 = Integer.parseInt(actionArray[1]);
                int buildingId2 = Integer.parseInt(actionArray[2]);
                city.createTube(buildingId1, buildingId2);

                double dist = City.euclideanDist(city.getBuildingById(buildingId1), city.getBuildingById(buildingId2));
                tubeBuilds.add(new TubeBuild(buildingId1, buildingId2, dist));

            } catch (NumberFormatException e) {
                gameManager.loseGame("Invalid integer value in " + action);
                return false;
            }
        } else if (actionArray[0].equals(Constants.UPGRADE_ACTION)) {
            if (actionArray.length != 3) {
                gameManager.loseGame("Invalid format: expected " + Constants.UPGRADE_ACTION + " [buildingId1] [buildingId2], but received " + action);
                return false;
            }

            try {
                int buildingId1 = Integer.parseInt(actionArray[1]);
                int buildingId2 = Integer.parseInt(actionArray[2]);
                city.upgradeTube(buildingId1, buildingId2);
                tubeUpgrades.add(new TubeUpgrade(buildingId1, buildingId2));

            } catch (NumberFormatException e) {
                gameManager.loseGame("Invalid integer value in " + action);
                return false;
            }
        } else if (actionArray[0].equals(Constants.TELEPORT_ACTION)) {
            if (actionArray.length != 3) {
                gameManager
                    .loseGame("Invalid format: expected " + Constants.TELEPORT_ACTION + " [buildingId1] [buildingId2], but received " + action);
                return false;
            }

            try {
                int buildingId1 = Integer.parseInt(actionArray[1]);
                int buildingId2 = Integer.parseInt(actionArray[2]);
                city.createTeleporter(buildingId1, buildingId2);
                teleporterBuilds.add(new TeleporterBuild(buildingId1, buildingId2));

            } catch (NumberFormatException e) {
                gameManager.loseGame("Invalid integer value in " + action);
            }
        } else if (actionArray[0].equals(Constants.POD_ACTION)) {
            if (actionArray.length < 3) {
                gameManager.loseGame(
                    "Invalid format: expected " + Constants.POD_ACTION + " [podId] [buildingId1] [buildingId2] [buildingId3] ... , but received "
                        + action
                );
                return false;
            }
            try {
                int podId = Integer.parseInt(actionArray[1]);
                ArrayList<Integer> routeBuildingIds = new ArrayList<Integer>();
                for (int i = 2; i < actionArray.length; i++) {
                    routeBuildingIds.add(Integer.valueOf(actionArray[i]));
                }
                city.createPod(podId, routeBuildingIds);
            } catch (NumberFormatException e) {
                gameManager.loseGame("Invalid integer value in " + action);
                return false;
            }
        } else if (actionArray[0].equals(Constants.DESTROY_ACTION)) {
            if (actionArray.length != 2) {
                gameManager.loseGame("Invalid format: expected " + Constants.DESTROY_ACTION + " [podId], but received " + action);
                return false;
            }
            try {
                int podId = Integer.parseInt(actionArray[1]);
                city.deletePod(podId);
            } catch (NumberFormatException e) {
                gameManager.loseGame("Invalid integer value in " + action);
                return false;
            }
        } else if (actionArray[0].equals(Constants.WAIT_ACTION) || actionArray[0].length() == 0) {
            // Do nothing
        } else {
            gameManager
                .loseGame(
                    String.format(
                        "Expected action: %s but received %s",
                        Arrays.asList(Constants.ACTIONS).stream().collect(Collectors.joining(" | ")),
                        actionArray[0]
                    )
                );
            return false;
        }
        return true;
    }

    private void launchNewTeleporterEvents(List<TeleporterBuild> builds) {
        for (TeleporterBuild build : builds) {
            EventData e = new EventData();
            e.type = EventData.NEW_TELEPORTER;
            e.params = new int[] { build.buildingId1(), build.buildingId2() };

            animation.startAnim(e, Animation.WHOLE);
        }
    }

    private void launchBuildingEvents(List<Building> newBuildings) {
        for (Building building : newBuildings) {
            EventData e = new EventData();
            e.type = EventData.NEW_BUILDING;
            e.params = new int[] { building.id };

            animation.startAnim(e, Animation.WHOLE);
        }
    }

    private void launchUpgradeEvents(List<TubeUpgrade> tubeUpgrades) {
        Map<List<Integer>, Integer> upgradeCountByTube = new HashMap<>();
        tubeUpgrades.stream()
            .forEach(upgrade -> {
                int building1 = upgrade.buildingId1() < upgrade.buildingId2() ? upgrade.buildingId1() : upgrade.buildingId2();
                int building2 = upgrade.buildingId1() != building1 ? upgrade.buildingId1() : upgrade.buildingId2();
                List<Integer> key = List.of(building1, building2);
                upgradeCountByTube.compute(key, (k, v) -> v == null ? 1 : v + 1);
            });

        for (List<Integer> buildings : upgradeCountByTube.keySet()) {
            EventData e = new EventData();
            e.type = EventData.UPGRADE_TUBE;
            e.params = new int[] { buildings.get(0), buildings.get(1), upgradeCountByTube.get(buildings) };

            animation.startAnim(e, Animation.HALF);
        }

    }

    private void launchBuildEvents(List<TubeBuild> tubeBuilds) {
        for (TubeBuild tubeBuild : tubeBuilds) {
            EventData e = new EventData();
            e.type = EventData.BUILD_TUBE;
            e.params = new int[] { tubeBuild.buildingId1(), tubeBuild.buildingId2() };

            double dist = City.euclideanDist(
                city.getBuildingById(tubeBuild.buildingId1()),
                city.getBuildingById(tubeBuild.buildingId2())
            );
            double p = dist / 20d;
            animation.startAnim(e, (int) (Animation.TENTH * p));
        }
    }

    public boolean isNewMonthFrame() {
        return newMonthFrame;
    }

    public boolean isEndOfMonthFrame() {
        return newMonth;
    }

    public int getMaxX() {
        return newBuildingsPerMonth.stream().flatMap(arr -> arr.stream()).mapToInt(b -> b.x).max().getAsInt();
    }

    public int getMaxY() {
        return newBuildingsPerMonth.stream().flatMap(arr -> arr.stream()).mapToInt(b -> b.y).max().getAsInt();
    }

    public int getMinX() {
        return newBuildingsPerMonth.stream().flatMap(arr -> arr.stream()).mapToInt(b -> b.x).min().getAsInt();
    }

    public int getMinY() {
        return newBuildingsPerMonth.stream().flatMap(arr -> arr.stream()).mapToInt(b -> b.y).min().getAsInt();
    }

}
