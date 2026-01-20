// Supabase client for So Long Sucker data collection

const SUPABASE_URL = 'https://fisiwiuxcaexlawqlfnl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2l3aXV4Y2FleGxhd3FsZm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzcyNTUsImV4cCI6MjA4MTc1MzI1NX0.QIA1uUId1ytjQdPL5Q_828Bgg3Vj9Xy4DPir6TDj-bE';
const STORAGE_BUCKET = 'game-data';

/**
 * Upload game data to Supabase Storage bucket
 * Overwrites existing file with same session ID
 * @param {string} sessionId - Unique session identifier
 * @param {Object} gameData - Full game data (from exportData())
 * @returns {Promise<boolean>} - Whether upload was successful
 */
export async function uploadGameToStorage(sessionId, gameData) {
  try {
    const filePath = `games/${sessionId}.json`;
    const jsonData = JSON.stringify(gameData, null, 2);
    
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-upsert': 'true' // Overwrite if exists
        },
        body: jsonData
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    console.log(`📤 Game data uploaded to storage: ${filePath}`);
    return true;
  } catch (error) {
    console.error('❌ Storage upload failed:', error);
    return false;
  }
}

/**
 * Save game summary to database table (lightweight, for quick queries)
 * Uses upsert to update existing records
 * @param {Object} summary - Game summary data
 * @returns {Promise<boolean>} - Whether save was successful
 */
export async function upsertGameSummary(summary) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/game_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(summary)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    console.log('📤 Game summary saved:', summary.session_id);
    return true;
  } catch (error) {
    console.error('❌ Summary save failed:', error);
    return false;
  }
}

/**
 * Save game session summary to database table
 * This is a lightweight record for quick queries
 * @param {Object} summary - Session summary data
 * @returns {Promise<boolean>}
 */
export async function saveSessionSummary(summary) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/game_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify(summary)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    console.log('📤 Session summary saved:', summary.session_id);
    return true;
  } catch (error) {
    console.error('❌ Summary save failed:', error);
    return false;
  }
}

/**
 * Update existing session summary (for status updates)
 * @param {string} sessionId - Session ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>}
 */
export async function updateSessionSummary(sessionId, updates) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/game_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ...updates,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Summary update failed:', error);
    return false;
  }
}

export { saveSessionSummary as saveGameSession };
