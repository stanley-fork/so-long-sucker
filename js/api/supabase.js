// Supabase client for So Long Sucker data collection

const SUPABASE_URL = 'https://fisiwiuxcaexlawqlfnl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc2l3aXV4Y2FleGxhd3FsZm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzcyNTUsImV4cCI6MjA4MTc1MzI1NX0.QIA1uUId1ytjQdPL5Q_828Bgg3Vj9Xy4DPir6TDj-bE';

/**
 * Save a game session to Supabase
 * @param {Object} sessionData - The session data to save
 * @returns {Promise<boolean>} - Whether save was successful
 */
export async function saveGameSession(sessionData) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/game_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(sessionData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    console.log('📤 Session saved to Supabase:', sessionData.session_id);
    return true;
  } catch (error) {
    console.error('❌ Supabase save failed:', error);
    // Non-blocking - don't break game if save fails
    return false;
  }
}
