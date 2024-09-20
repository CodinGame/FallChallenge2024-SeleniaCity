import java.util.*;
import java.io.*;
import java.math.*;

/**
 * Auto-generated code below aims at helping you parse
 * the standard input according to the problem statement.
 **/
class Solution {

    public static void main(String args[]) {
        Scanner in = new Scanner(System.in);

        // game loop
        while (true) {
            int resources = in.nextInt();
            int numTravelRoutes = in.nextInt();
            for (int i = 0; i < numTravelRoutes; i++) {
                int buildingId1 = in.nextInt();
                int buildingId2 = in.nextInt();
                int capacity = in.nextInt();
            }
            int numPods = in.nextInt();
            if (in.hasNextLine()) {
                in.nextLine();
            }
            for (int i = 0; i < numPods; i++) {
                String podProperties = in.nextLine();
            }
            int numNewBuildings = in.nextInt();
            if (in.hasNextLine()) {
                in.nextLine();
            }
            for (int i = 0; i < numNewBuildings; i++) {
                String buildingProperties = in.nextLine();
            }

            // Write an answer using System.out.println()
            // To debug: System.err.println("Debug messages...");

            System.out.println("TUBE 0 1;TUBE 0 2;POD 1234 0 1 0 2 0 1 0 2"); // TUBE | UPGRADE | TELEPORT | POD | DESTROY | WAIT
        }
    }
}