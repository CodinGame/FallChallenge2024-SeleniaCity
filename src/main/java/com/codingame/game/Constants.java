package com.codingame.game;

import java.util.List;

import com.codingame.event.EventData;

public class Constants {
    public static final int BOARD_SIZE_X = 192;
    public static final int BOARD_SIZE_Y = 108;

    public static final String TUBE_ACTION = "TUBE";
    public static final String UPGRADE_ACTION = "UPGRADE";
    public static final String TELEPORT_ACTION = "TELEPORT";
    public static final String POD_ACTION = "POD";
    public static final String DESTROY_ACTION = "DESTROY";
    public static final String WAIT_ACTION = "WAIT";
    public static final String[] ACTIONS = new String[] { TUBE_ACTION, UPGRADE_ACTION, TELEPORT_ACTION, POD_ACTION, DESTROY_ACTION };

    public static final int MAX_TUBES_PER_BUILDING = 5;
    public static final int RESOURCE_INTEREST_PERCENTAGE = 110;
    public static final int TUBE_COST = 10; // per 1km, rounded down
    public static final int TELEPORTER_COST = 5_000;
    public static final int POD_COST = 1_000;
    public static final int POD_DESTROY_VALUE = 750;

    public static final int POD_CAPACITY = 10;
    public static final int MAX_POD_ID = 500;

    public static final int MAX_SPEED_POINTS = 50;
    public static final int MAX_DIVERSITY_POINTS = 50;

    public static final int DAYS_PER_MONTH = 20;

    public static final int LANDING_BUILDING_TYPE = 0;

    public static final int ASTRONAUT_ID_MULT = 1000; // Needs to be higher than the max number of astronauts per rocket

    public static final int MAX_WARNINGS_DISPLAYED = 5;

    public static final List<Integer> SIMPLIFIED_SKIPPED_EVENTS = List.of(EventData.TRANSPORT_POD, EventData.TRANSPORT_TP, EventData.ARRIVAL);
}
