package com.codingame.view;

import com.codingame.game.Referee;
import com.codingame.gameengine.core.AbstractPlayer;
import com.codingame.gameengine.core.GameManager;
import com.codingame.gameengine.core.Module;
import com.google.inject.Inject;
import com.google.inject.Singleton;

@Singleton
public class ViewModule implements Module {

    private GameManager<AbstractPlayer> gameManager;
    private Referee referee;

    @Inject
    ViewModule(GameManager<AbstractPlayer> gameManager) {
        this.gameManager = gameManager;
        gameManager.registerModule(this);
    }

    public void init(Referee referee) {
        this.referee = referee;
    }

    @Override
    public final void onGameInit() {
        sendGlobalData();
        sendFrameData();
    }

    private void sendFrameData() {
        gameManager.setViewData("graphics", Serializer.serializeFrameData(referee));
    }

    private void sendGlobalData() {
        gameManager.setViewGlobalData("graphics", Serializer.serializeGlobalData(referee));

    }

    @Override
    public final void onAfterGameTurn() {
        sendFrameData();
    }

    @Override
    public final void onAfterOnEnd() {
    }

}
