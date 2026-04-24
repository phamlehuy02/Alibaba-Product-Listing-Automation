export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { AutomationEngine } = await import('./lib/automation-engine');
    AutomationEngine.init();
  }
}
