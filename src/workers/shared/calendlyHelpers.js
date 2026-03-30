const axios = require('axios');
const logger = require('../../utils/logger');

const CALENDLY_API_KEY = process.env.CALENDLY_API_KEY;
const CALENDLY_BASE_URL = 'https://api.calendly.com/v1';

/**
 * Get Calendly user URI
 */
async function getUserUri() {
  try {
    const response = await axios.get(`${CALENDLY_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${CALENDLY_API_KEY}`,
      },
    });
    return response.data.resource.uri;
  } catch (error) {
    logger.error('[Calendly] Failed to get user URI:', error.message);
    return null;
  }
}

/**
 * Get recent event invitations
 */
async function getRecentBookings(sinceTimestamp) {
  try {
    const userUri = await getUserUri();
    if (!userUri) return [];

    const response = await axios.get(`${CALENDLY_BASE_URL}/event_invitations`, {
      headers: {
        'Authorization': `Bearer ${CALENDLY_API_KEY}`,
      },
      params: {
        user: userUri,
        status: 'active',
        sort: '-updated_at',
        count: 50,
      },
    });

    const invitations = response.data.collection || [];
    const sinceDate = new Date(sinceTimestamp);
    
    return invitations.filter(inv => {
      const updatedDate = new Date(inv.updated_at);
      return updatedDate > sinceDate && inv.status === 'active';
    });
  } catch (error) {
    logger.error('[Calendly] Failed to get bookings:', error.message);
    return [];
  }
}

/**
 * Format booking details
 */
function formatBooking(invitation) {
  return {
    name: invitation.name || 'Unknown',
    email: invitation.email || 'unknown@example.com',
    eventType: invitation.event_type,
    scheduledTime: invitation.scheduled_event ? 
      new Date(invitation.scheduled_event).toISOString() : null,
    status: invitation.status,
  };
}

module.exports = {
  getUserUri,
  getRecentBookings,
  formatBooking,
};
