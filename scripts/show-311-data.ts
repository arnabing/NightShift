#!/usr/bin/env tsx
/**
 * Quick script to show 311 complaint data and how it's being used
 */

import { prisma } from "../lib/prisma";

async function showComplaintData() {
  console.log("\n🚨 NYC 311 Noise Complaint Data Analysis\n");
  console.log("=" .repeat(80));

  const venues = await prisma.venue.findMany({
    where: {
      noiseComplaints: {
        gt: 0,
      },
    },
    orderBy: {
      noiseComplaints: "desc",
    },
  });

  console.log(`\nFound ${venues.length} venues with 311 complaint data:\n`);

  for (const venue of venues) {
    console.log(`\n📍 ${venue.name} (${venue.neighborhood})`);
    console.log(`   Complaints (90 days): ${venue.noiseComplaints}`);
    console.log(`   Last Complaint: ${venue.lastComplaint?.toLocaleDateString()}`);

    if (venue.complaintPattern) {
      const pattern = venue.complaintPattern as any;
      console.log(`   Consistency Score: ${pattern.consistencyScore}%`);

      if (pattern.byDayOfWeek) {
        console.log(`   Complaints by Day:`);
        Object.entries(pattern.byDayOfWeek).forEach(([day, count]) => {
          if (count > 0) {
            console.log(`      ${day}: ${count}`);
          }
        });
      }

      if (pattern.peakHours && pattern.peakHours.length > 0) {
        console.log(`   Peak Hours: ${pattern.peakHours.join(", ")}`);
      }

      if (pattern.weeklyTrends) {
        console.log(`   Weekly Trends (last 10 weeks):`);
        const trends = pattern.weeklyTrends as any;
        if (trends.friday) {
          console.log(`      Friday: ${trends.friday.join(", ")} complaints/week`);
        }
        if (trends.saturday) {
          console.log(`      Saturday: ${trends.saturday.join(", ")} complaints/week`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n💡 How 311 Data is Leveraged:\n");
  console.log("1. Activity Level Score (25% of total):");
  console.log("   - Sweet spot: 10-25 complaints = 100% score");
  console.log("   - Too few (<10) = venue might be dead");
  console.log("   - Too many (>25) = might indicate problems");
  console.log("");
  console.log("2. Activity Prediction:");
  console.log("   - Uses day-of-week patterns to predict if venue will be busy tonight");
  console.log("   - Consistency score shows reliability of prediction");
  console.log("   - Peak hours tell users best time to go");
  console.log("");
  console.log("3. Weekly Trends:");
  console.log("   - Analyzes last 10 weeks of Fridays/Saturdays");
  console.log("   - Helps identify venues with reliable weekend activity");
  console.log("");

  await prisma.$disconnect();
}

showComplaintData().catch(console.error);
