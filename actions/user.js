"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
// import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";



export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Start a transaction to handle both operations
    const result = await db.$transaction(
      async (tx) => {
        // First check if industry exists
        let industryInsight = await tx.industryInsight.findUnique({
          where: {
            industry: data.industry,
          },
        });
        
// If industry doesn't exist, create it with default values 
//without gemini api
        // if (!industryInsight) {
        //   industryInsight = await tx.industryInsight.create({
        //     data: {
        //       industry: data.industry,
        //       salaryRanges: [],
        //       growthRate: 0,
        //       demandLevel: "MEDIUM",
        //       topSkills: [],
        //       marketOutlook: "NEUTRAL",
        //       keyTrends: [],
        //       recommendedSkills: [],
        //       nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        //     },
        //   });
        // }

//with gemini api
        if (!industryInsight) {
          const insights = await generateAIInsights(data.industry);

          industryInsight = await db.industryInsight.create({
            data: {
              industry: data.industry,
              ...insights,
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        }

        // Now update the user
        const updatedUser = await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            industry: data.industry,
            experience: data.experience,
            bio: data.bio,
            skills: data.skills,
          },
        });

        return { updatedUser, industryInsight };
      },
      {
        timeout: 10000, // default: 5000
      }
    );
    return { success: true, ...result };
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    throw new Error("Failed to update profile"+ error.message);
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true },
  });

  if (!user || !user.industry) {
    return { isOnboarded: false };
  }

  // ✅ New logic: check if industryInsight exists
  const insight = await db.industryInsight.findUnique({
    where: { industry: user.industry },
  });

  return {
    isOnboarded: !!(user.industry && insight),
  };
}
