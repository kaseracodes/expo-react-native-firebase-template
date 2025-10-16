const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Admin SDK once
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// --------------------------------------------------
// Example HTTP function (unchanged)
exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});

// --------------------------------------------------
// Example callable function (unchanged)
exports.createUser = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { name, email } = data;
  return {
    success: true,
    message: `User ${name} created successfully`,
    userId: context.auth.uid,
  };
});

// --------------------------------------------------
// NEW: Firestore trigger to send notification when a document is created
// Path: notifications/{notificationId}
// Expected doc shape:
// {
//   title: string,
//   body: string,
//   userId?: string,          // optional: target one user
//   token?: string,           // optional: direct FCM token (overrides topic/user)
//   topic?: string,           // optional: FCM topic (e.g., "user_updates")
//   data?: { [key: string]: string } // optional key-value data
// }
exports.sendNotificationOnCreate = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const payload = snap.data() || {};
    const { title, body, userId, token, topic, data } = payload;

    if (!title || !body) {
      functions.logger.warn("Missing title/body in notification doc", payload);
      return null;
    }

    // Determine target: direct token > topic > user token lookup
    let targetToken = token;

    if (!targetToken && userId) {
      // Look up the user's FCM token in Firestore, e.g., users/{userId}/meta/fcmToken
      // Adjust this path to match where the app stores tokens
      const tokenDoc = await db
        .collection("users")
        .doc(userId)
        .collection("meta")
        .doc("messaging")
        .get();

      targetToken = tokenDoc.exists ? tokenDoc.get("fcmToken") : null;
    }

    // Build base message
    const message = {
      notification: { title, body },
      data: sanitizeData(data),
      android: {
        priority: "high",
        notification: { channelId: "default" },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    };

    try {
      if (targetToken) {
        // Send to a single device token
        const res = await messaging.send({ ...message, token: targetToken });
        functions.logger.info("Sent notification to token", { res });
      } else if (topic) {
        // Send to a topic
        const res = await messaging.send({ ...message, topic });
        functions.logger.info("Sent notification to topic", { topic, res });
      } else {
        functions.logger.warn(
          "No token/topic/userId provided; notification not sent."
        );
      }
    } catch (err) {
      functions.logger.error("Error sending notification", err);
    }

    return null;
  });

// --------------------------------------------------
// NEW: Callable function to send a notification on-demand
// Call from the app with httpsCallable('sendNotification'):
// { title, body, token?, topic?, userId?, data? }
exports.sendNotification = functions.https.onCall(async (data, context) => {
  // Optional: Require auth
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'Auth required.');
  // }

  const { title, body, token, topic, userId, data: extraData } = data || {};

  if (!title || !body) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "title and body are required."
    );
  }

  let targetToken = token;

  if (!targetToken && userId) {
    const tokenDoc = await db
      .collection("users")
      .doc(userId)
      .collection("meta")
      .doc("messaging")
      .get();

    targetToken = tokenDoc.exists ? tokenDoc.get("fcmToken") : null;
  }

  const message = {
    notification: { title, body },
    data: sanitizeData(extraData),
    android: {
      priority: "high",
      notification: { channelId: "default" },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: {
        aps: {
          sound: "default",
          contentAvailable: true,
        },
      },
    },
  };

  try {
    let response;
    if (targetToken) {
      response = await messaging.send({ ...message, token: targetToken });
    } else if (topic) {
      response = await messaging.send({ ...message, topic });
    } else {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Provide at least one of: token, topic, or userId."
      );
    }
    return { success: true, messageId: response };
  } catch (error) {
    functions.logger.error("Error sending notification", error);
    throw new functions.https.HttpsError("internal", "Failed to send");
  }
});

// --------------------------------------------------
// Utility: FCM data values must be strings
function sanitizeData(obj) {
  if (!obj || typeof obj !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    out[String(k)] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}
