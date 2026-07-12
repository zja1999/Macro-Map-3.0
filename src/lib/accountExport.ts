import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  challengeParticipants,
  challenges,
  badges,
  comments,
  contentWarnings,
  dailyHealthMetrics,
  externalSampleLinks,
  fastingWindows,
  feedback,
  foodLogs,
  follows,
  goToOrders,
  groceryItems,
  groceryLists,
  groupMembers,
  groups,
  habitLogs,
  habits,
  integrationAccounts,
  integrationSyncRuns,
  mealPrepItems,
  mealPrepPlans,
  mediaAttachments,
  moderationActions,
  notifications,
  nutritionImportBatches,
  nutritionTargets,
  oauthAccounts,
  personalIngredients,
  personalRecords,
  photos,
  posts,
  profiles,
  progressEntries,
  reactions,
  recipeIngredients,
  recipeReviews,
  recipes,
  reports,
  saves,
  sleepLogs,
  sleepStageSamples,
  users,
  userBadges,
  votes,
  waterLogs,
  workoutLogs,
  workoutRoutes,
  workouts,
} from "@/db/schema";

/**
 * Produce a portable snapshot of data belonging to one authenticated user.
 *
 * Deliberately absent: password hashes, sessions, verification/reset tokens,
 * rate-limit fingerprints, push device tokens, encrypted health credentials,
 * provider sync cursors/error payloads, and internal object-storage keys.
 */
export async function buildAccountExport(userId: string) {
  const [accountRows, profileRows, oauthRows, integrationRows, syncRunRows, earnedBadgeRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        role: users.role,
        reputation: users.reputation,
        isGuest: users.isGuest,
        bannedAt: users.bannedAt,
        bannedReason: users.bannedReason,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({
        provider: oauthAccounts.provider,
        providerAccountId: oauthAccounts.providerAccountId,
        email: oauthAccounts.email,
        createdAt: oauthAccounts.createdAt,
      })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId)),
    db
      .select({
        id: integrationAccounts.id,
        provider: integrationAccounts.provider,
        providerAccountId: integrationAccounts.providerAccountId,
        displayName: integrationAccounts.displayName,
        scopes: integrationAccounts.scopes,
        expiresAt: integrationAccounts.expiresAt,
        syncSettings: integrationAccounts.syncSettings,
        lastSyncedAt: integrationAccounts.lastSyncedAt,
        status: integrationAccounts.status,
        createdAt: integrationAccounts.createdAt,
        updatedAt: integrationAccounts.updatedAt,
      })
      .from(integrationAccounts)
      .where(eq(integrationAccounts.userId, userId)),
    db
      .select({
        id: integrationSyncRuns.id,
        accountId: integrationSyncRuns.accountId,
        provider: integrationSyncRuns.provider,
        kind: integrationSyncRuns.kind,
        status: integrationSyncRuns.status,
        startedAt: integrationSyncRuns.startedAt,
        finishedAt: integrationSyncRuns.finishedAt,
        samplesRead: integrationSyncRuns.samplesRead,
        samplesWritten: integrationSyncRuns.samplesWritten,
      })
      .from(integrationSyncRuns)
      .where(eq(integrationSyncRuns.userId, userId)),
    db
      .select({ award: userBadges, badge: badges })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(eq(userBadges.userId, userId)),
  ]);

  const account = accountRows[0];
  if (!account) throw new Error("Account not found");

  const ownPhotoIds = db.select({ id: photos.id }).from(photos).where(eq(photos.userId, userId));
  const ownRecipeIds = db.select({ id: recipes.id }).from(recipes).where(eq(recipes.authorId, userId));
  const ownHabitIds = db.select({ id: habits.id }).from(habits).where(eq(habits.userId, userId));
  const ownListIds = db.select({ id: groceryLists.id }).from(groceryLists).where(eq(groceryLists.userId, userId));
  const ownPlanIds = db.select({ id: mealPrepPlans.id }).from(mealPrepPlans).where(eq(mealPrepPlans.authorId, userId));

  const [
    targets,
    followRelationships,
    authoredPosts,
    authoredComments,
    ownReactions,
    ownVotes,
    ownSaves,
    ownPhotos,
    attachments,
    diary,
    water,
    authoredRecipes,
    ingredients,
    reviews,
    privateIngredients,
    savedOrders,
    progress,
    ownHabits,
    habitHistory,
    inbox,
    fasts,
    sleep,
    healthMetrics,
    sleepStages,
    ownFeedback,
    importHistory,
    authoredWorkouts,
    workoutHistory,
    routes,
    externalLinks,
    records,
    groceryListRows,
    groceryItemRows,
    authoredPlans,
    planItems,
    createdGroups,
    memberships,
    createdChallenges,
    challengeHistory,
    submittedReports,
    staffActions,
    warningsAdded,
  ] = await Promise.all([
    db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, userId)),
    db.select().from(follows).where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId))),
    db.select().from(posts).where(eq(posts.authorId, userId)),
    db.select().from(comments).where(eq(comments.authorId, userId)),
    db.select().from(reactions).where(eq(reactions.userId, userId)),
    db.select().from(votes).where(eq(votes.userId, userId)),
    db.select().from(saves).where(eq(saves.userId, userId)),
    db
      .select({
        id: photos.id,
        purpose: photos.purpose,
        mimeType: photos.mimeType,
        width: photos.width,
        height: photos.height,
        isPrivate: photos.isPrivate,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .where(eq(photos.userId, userId)),
    db.select().from(mediaAttachments).where(inArray(mediaAttachments.photoId, ownPhotoIds)),
    db.select().from(foodLogs).where(eq(foodLogs.userId, userId)),
    db.select().from(waterLogs).where(eq(waterLogs.userId, userId)),
    db.select().from(recipes).where(eq(recipes.authorId, userId)),
    db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, ownRecipeIds)),
    db.select().from(recipeReviews).where(eq(recipeReviews.userId, userId)),
    db.select().from(personalIngredients).where(eq(personalIngredients.userId, userId)),
    db.select().from(goToOrders).where(eq(goToOrders.userId, userId)),
    db.select().from(progressEntries).where(eq(progressEntries.userId, userId)),
    db.select().from(habits).where(eq(habits.userId, userId)),
    db.select().from(habitLogs).where(inArray(habitLogs.habitId, ownHabitIds)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(fastingWindows).where(eq(fastingWindows.userId, userId)),
    db.select().from(sleepLogs).where(eq(sleepLogs.userId, userId)),
    db.select().from(dailyHealthMetrics).where(eq(dailyHealthMetrics.userId, userId)),
    db.select().from(sleepStageSamples).where(eq(sleepStageSamples.userId, userId)),
    db.select().from(feedback).where(eq(feedback.userId, userId)),
    db.select().from(nutritionImportBatches).where(eq(nutritionImportBatches.uploadedBy, userId)),
    db.select().from(workouts).where(eq(workouts.authorId, userId)),
    db.select().from(workoutLogs).where(eq(workoutLogs.userId, userId)),
    db
      .select({
        id: workoutRoutes.id,
        workoutLogId: workoutRoutes.workoutLogId,
        source: workoutRoutes.source,
        externalProvider: workoutRoutes.externalProvider,
        externalId: workoutRoutes.externalId,
        encodedPolyline: workoutRoutes.encodedPolyline,
        distanceM: workoutRoutes.distanceM,
        elevationGainM: workoutRoutes.elevationGainM,
        privacyStatus: workoutRoutes.privacyStatus,
        startHiddenM: workoutRoutes.startHiddenM,
        endHiddenM: workoutRoutes.endHiddenM,
        createdAt: workoutRoutes.createdAt,
      })
      .from(workoutRoutes)
      .where(eq(workoutRoutes.userId, userId)),
    db.select().from(externalSampleLinks).where(eq(externalSampleLinks.userId, userId)),
    db.select().from(personalRecords).where(eq(personalRecords.userId, userId)),
    db.select().from(groceryLists).where(eq(groceryLists.userId, userId)),
    db.select().from(groceryItems).where(inArray(groceryItems.listId, ownListIds)),
    db.select().from(mealPrepPlans).where(eq(mealPrepPlans.authorId, userId)),
    db.select().from(mealPrepItems).where(inArray(mealPrepItems.planId, ownPlanIds)),
    db.select().from(groups).where(eq(groups.createdBy, userId)),
    db.select().from(groupMembers).where(eq(groupMembers.userId, userId)),
    db.select().from(challenges).where(eq(challenges.createdBy, userId)),
    db.select().from(challengeParticipants).where(eq(challengeParticipants.userId, userId)),
    db
      .select({
        id: reports.id,
        subjectType: reports.subjectType,
        subjectId: reports.subjectId,
        reason: reports.reason,
        detail: reports.detail,
        status: reports.status,
        reviewedAt: reports.reviewedAt,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.reporterId, userId)),
    db.select().from(moderationActions).where(eq(moderationActions.actorId, userId)),
    db.select().from(contentWarnings).where(eq(contentWarnings.addedBy, userId)),
  ]);

  return {
    format: "macroverse-account-export",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    account,
    profile: profileRows[0] ?? null,
    authentication: { connectedAccounts: oauthRows },
    nutrition: { targets, diary, water, privateIngredients, savedOrders },
    recipes: { authored: authoredRecipes, ingredients, reviews },
    health: { progress, habits: ownHabits, habitHistory, fasts, sleep, healthMetrics, sleepStages },
    fitness: { authoredWorkouts, workoutHistory, routes, personalRecords: records },
    planning: { groceryLists: groceryListRows, groceryItems: groceryItemRows, authoredPlans, planItems },
    community: {
      followRelationships,
      authoredPosts,
      authoredComments,
      reactions: ownReactions,
      votes: ownVotes,
      saves: ownSaves,
      photos: ownPhotos,
      mediaAttachments: attachments,
      notifications: inbox,
      createdGroups,
      memberships,
      createdChallenges,
      challengeHistory,
      submittedReports,
      feedback: ownFeedback,
      badges: earnedBadgeRows,
    },
    integrations: { accounts: integrationRows, syncRuns: syncRunRows, externalSampleLinks: externalLinks },
    administration: { importHistory, moderationActions: staffActions, contentWarningsAdded: warningsAdded },
    exclusions: [
      "password hashes and authentication/session tokens",
      "email verification and password-reset tokens",
      "rate-limit fingerprints and push device tokens",
      "encrypted integration credentials, sync cursors, provider error payloads, and storage keys",
      "data owned by other users, except relationship IDs and messages already delivered to this account",
    ],
  };
}
