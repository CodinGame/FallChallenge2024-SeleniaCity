import com.codingame.gameengine.runner.SoloGameRunner;

public class Main {
    public static void main(String[] args) {
        SoloGameRunner gameRunner = new SoloGameRunner();

        // Sets the player
        gameRunner.setAgent(Solution.class);

        // Sets a test case
        gameRunner.setTestCase("test1.json");

        gameRunner.start();
    }
}
