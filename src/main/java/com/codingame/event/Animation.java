package com.codingame.event;

import java.util.ArrayList;
import java.util.List;

import com.google.inject.Singleton;

@Singleton
public class Animation {
    public static final int HUNDREDTH = 10;
    public static final int TWENTIETH = 50;
    public static final int TENTH = 100;
    public static final int THIRD = 300;
    public static final int HALF = 500;
    public static final int WHOLE = 1000;
    // Of a second

    private int frameTime;
    private int endTime;

    List<EventData> viewerEvents;

    public Animation() {
        viewerEvents = new ArrayList<>();
    }

    public void reset() {
        getViewerEvents().clear();
        frameTime = 0;
        endTime = 0;
    }

    public int wait(int time) {
        return frameTime += time;
    }

    public int getFrameTime() {
        return frameTime;
    }

    public void startAnim(EventData e, int duration) {
        e.animData = new AnimationData(frameTime, duration);
        endTime = Math.max(endTime, frameTime + duration);
        add(e);
    }

    public void waitForAnim(EventData e, int duration) {
        e.animData = new AnimationData(frameTime, duration);
        frameTime += duration;
        endTime = Math.max(endTime, frameTime);
        add(e);
    }

    public void setFrameTime(int startTime) {
        this.frameTime = startTime;
    }

    public int getEndTime() {
        return endTime;
    }

    public void catchUp() {
        frameTime = endTime;

    }

    public void add(EventData e) {
        getViewerEvents().add(e);

    }

    public List<EventData> getViewerEvents() {
        return viewerEvents;
    }
}
