package com.codingame.game;

public class GameWarning extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public GameWarning(String message) {
        super(message);
    }

    public GameWarning(String message, Throwable cause) {
        super(message, cause);
    }
}