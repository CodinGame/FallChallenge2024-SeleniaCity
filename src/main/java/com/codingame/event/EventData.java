package com.codingame.event;

import com.codingame.view.history.PodTransport;

public class EventData {
    public static final int BUILD_TUBE = 0;
    public static final int BUILD_POD = 1;
    public static final int TRANSPORT_POD = 2;
    public static final int TRANSPORT_TP = 3;
    public static final int UPGRADE_TUBE = 4;
    public static final int ARRIVAL = 5;
    public static final int DESTROY_POD = 6;
    public static final int NEW_BUILDING = 7;
    public static final int NEW_TELEPORTER = 8;

    public int type;
    public AnimationData animData;
    public int[] params;
    public PodTransport podTransport;

    public EventData() {

    }

}
