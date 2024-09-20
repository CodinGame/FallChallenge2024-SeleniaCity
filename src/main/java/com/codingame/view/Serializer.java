package com.codingame.view;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.codingame.event.EventData;
import com.codingame.game.Building;
import com.codingame.game.Constants;
import com.codingame.game.Referee;
import com.codingame.view.history.PodTransport;

public class Serializer {
    public static final String MAIN_SEPARATOR = "\n";
    private static final String BASE91_CHARSET = "0123456789:<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~!\"#$%&()*+,-./";
    private static final BigInteger BASE = new BigInteger(String.valueOf(BASE91_CHARSET.length()));

    private static final int MAX_HASHES = 1000;
    private static HashMap<String, Integer> podTransportHashes = new HashMap<>();

    static public String serialize(EventData e) {
        String event = join(
            e.type,
            e.animData.start,
            e.animData.end,
            e.type == EventData.TRANSPORT_POD
                ? join(serialize(e.params), serializePodTransport(e.podTransport)).trim()
                : serialize(e.params)
        );
        if (podTransportHashes.containsKey(event)) {
            return String.valueOf(podTransportHashes.get(event));
        }
        if (podTransportHashes.size() < MAX_HASHES) {
            int next = podTransportHashes.size();
            podTransportHashes.put(event, next);
        }
        return event;
    }

    static public String serialize(int[] intArray) {
        return Arrays.stream(intArray).mapToObj(String::valueOf).collect(Collectors.joining(" "));
    }

    static public String serializePodTransport(PodTransport pt) {
        if (pt.workers.isEmpty()) {
            return "";
        }

        BigInteger code = new BigInteger(pt.workers.stream().map(nb -> "%02d".formatted(nb)).collect(Collectors.joining()));
        String base = toBase91(code);
        return base;
    }

    public static String toBase91(BigInteger num) {
        if (num.equals(BigInteger.ZERO)) {
            return String.valueOf(BASE91_CHARSET.charAt(0)); // Return the first character for zero
        }

        StringBuilder result = new StringBuilder();

        while (num.compareTo(BigInteger.ZERO) > 0) {
            BigInteger[] divAndRemainder = num.divideAndRemainder(BASE); // Get quotient and remainder
            int remainder = divAndRemainder[1].intValue(); // Convert remainder to int for indexing
            result.insert(0, BASE91_CHARSET.charAt(remainder)); // Prepend the corresponding character
            num = divAndRemainder[0]; // Update num with the quotient
        }

        return result.toString();
    }

    static public String join(Object... args) {
        return Stream.of(args)
            .map(String::valueOf)
            .collect(Collectors.joining(" "));
    }

    public static String serializeGlobalData(Referee referee) {
        List<Object> lines = new ArrayList<>();

        lines.add(referee.getMinX());
        lines.add(referee.getMinY());
        lines.add(referee.getMaxX());
        lines.add(referee.getMaxY());

        lines.add(referee.simplifiedMode ? 1 : 0);
        lines.add(referee.gameRatio != null ? referee.gameRatio : 0);

        CityDto cityDto = new CityDto(referee.city);
        cityDto.buildings = referee.newBuildingsforView.stream().map(b -> new BuildingDto(b)).toList();
        cityDto.resources = referee.city.resources;

        lines.add(serialize(cityDto));
        return lines.stream()
            .map(String::valueOf)
            .collect(Collectors.joining(MAIN_SEPARATOR));
    }

    private static String serialize(CityDto cityDto) {
        List<Object> lines = new ArrayList<>();
        lines.add(cityDto.buildings.size());
        for (BuildingDto building : cityDto.buildings) {
            lines.add(building.id);
            lines.add(building.buildingType);
            lines.add(building.x);
            lines.add(building.y);
        }
        lines.add(cityDto.resources);
        return lines.stream()
            .map(String::valueOf)
            .collect(Collectors.joining(" "));
    }

    public static String serializeFrameData(Referee referee) {
        List<Object> lines = new ArrayList<>();

        List<Building> newBuildingsThisMonth = referee.newBuildingsforView;
        lines.add(referee.isNewMonthFrame() ? 1 : 0);
        lines.add(referee.isEndOfMonthFrame() ? 1 : 0);

        if (referee.isNewMonthFrame()) {
            CityDto cityDto = new CityDto(referee.city);
            cityDto.buildings = newBuildingsThisMonth.stream().map(b -> new BuildingDto(b)).toList();
            cityDto.resources = referee.city.resources;

            lines.add(referee.totalScore);
            lines.add(serialize(cityDto));
        }

        if (referee.isEndOfMonthFrame()) {
            lines.add(referee.totalScore);
            lines.add(referee.city.resources);
        }

        List<EventData> events = referee.getViewerEvents();

        if (referee.simplifiedMode) {
            events = events.stream()
                .filter(event -> !Constants.SIMPLIFIED_SKIPPED_EVENTS.contains(event.type))
                .toList();
        }

        lines.add(events.size());
        events.stream()
            .map(e -> serialize(e))
            .forEach(lines::add);

        String unzipped = lines.stream()
            .map(String::valueOf)
            .collect(Collectors.joining(MAIN_SEPARATOR));
        return StringCompressor.compressToBase64(unzipped);

    }

}
