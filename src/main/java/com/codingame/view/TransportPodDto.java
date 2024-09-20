package com.codingame.view;

import java.util.List;
import java.util.stream.Collectors;

import com.codingame.game.TransportPod;

public class TransportPodDto {
    public int id;
    public List<Integer> route;
    public int currentIndex;
    public int remainingCapacity;

    public TransportPodDto(TransportPod pod) {
        this.id = pod.id;
        this.route = pod.route.stream().map(b -> b.id).collect(Collectors.toList());
        this.currentIndex = pod.currentIndex;
        this.remainingCapacity = pod.remainingCapacity;
    }
}