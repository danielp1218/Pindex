import { useState, useEffect } from 'react';
import './App.css';
import { GraphData } from '@/types/graph';
import { getCurrentPageState, saveCurrentPageState } from '@/utils/eventStorage';
import DecisionScreen from './DecisionScreen.tsx';
import AddNodesScreen from './AddNodesScreen.tsx';
import VisualizationScreen from './VisualizationScreen.tsx';

type Screen = 'decision' | 'add' | 'visualize';

function App() {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('decision');
  const [userSelection, setUserSelection] = useState<'yes' | 'no' | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [{ id: 'root', label: 'Root' }],
    links: [],
  });

  useEffect(() => {
    const initialize = async () => {
      // Get user selection from storage
      try {
        const stored = await browser.storage.local.get(['lastUserSelection', 'selectionTimestamp']);
        if (stored.lastUserSelection && typeof stored.selectionTimestamp === 'number') {
          // Only use if selection was made in the last 5 seconds (to avoid stale data)
          const age = Date.now() - stored.selectionTimestamp;
          if (age < 5000 && (stored.lastUserSelection === 'yes' || stored.lastUserSelection === 'no')) {
            setUserSelection(stored.lastUserSelection);
          }
        }
      } catch (error) {
        console.error('Error loading user selection:', error);
      }

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id && tab.url) {
        console.log('Tab URL:', tab.url);
        const isEventPage = tab.url.includes('polymarket.com/event/');
        console.log('Is event page:', isEventPage);
        if (isEventPage) {
          setPageUrl(tab.url);
          // Also try to get selection from content script
          try {
            const response = await browser.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
            if (response?.userSelection) {
              setUserSelection(response.userSelection);
            }
          } catch (error) {
            console.error('Error getting page info:', error);
          }
        } else {
          setPageUrl(null);
          setLoading(false);
          return;
        }
        try {
          const savedState = await getCurrentPageState(tab.url);
          if (savedState && savedState.graphData) {
            setGraphData(savedState.graphData);
          }
        } catch (error) {
          console.error('Error loading saved state:', error);
        }
      }
      setLoading(false);
    };

    initialize();
  }, []);

  const saveGraphData = async (newGraphData: GraphData) => {
    setGraphData(newGraphData);
    if (pageUrl) {
      await saveCurrentPageState(pageUrl, { graphData: newGraphData });
    }
  };

  // Extract event title from URL
  const getEventTitle = () => {
    if (!pageUrl) return 'Market Decision';
    const slug = pageUrl.split('/event/')[1]?.split('?')[0] || '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Market Decision';
  };

  if (loading) {
    return (
      <div style={{ minWidth: '420px', minHeight: '500px', background: '#0a0f1a', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!pageUrl) {
    return (
      <div style={{ padding: '20px', minWidth: '420px', minHeight: '500px', background: '#0a0f1a', color: '#e2e8f0' }}>
        <h2>Polyindex</h2>
        <p>Inactive - Navigate to a Polymarket event page</p>
      </div>
    );
  }

  // Decision Screen (main)
  if (currentScreen === 'decision') {
    return (
      <DecisionScreen
        eventTitle={getEventTitle()}
        userSelection={userSelection}
        onViewNodes={() => setCurrentScreen('visualize')}
      />
    );
  }

  // Nodes screens
  return (
    <div style={{ padding: '20px', width: '420px', minWidth: '420px', maxWidth: '420px', height: '600px', maxHeight: '600px', background: '#0a0f1a', color: '#e2e8f0', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => setCurrentScreen('decision')}
          style={{
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            padding: '8px 0',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '80px',
            fontSize: '12px',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, flex: 1, fontSize: '16px' }}>Polyindex</h2>
        <button
          onClick={() => setCurrentScreen('visualize')}
          style={{
            background: currentScreen === 'visualize' ? '#3b82f6' : '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            padding: '8px 0',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '80px',
            fontSize: '12px',
          }}
        >
          Visualize
        </button>
        <button
          onClick={() => setCurrentScreen('add')}
          style={{
            background: currentScreen === 'add' ? '#3b82f6' : '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            padding: '8px 0',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '80px',
            fontSize: '12px',
          }}
        >
          Add Nodes
        </button>
      </div>
      
      {currentScreen === 'visualize' ? (
        <VisualizationScreen graphData={graphData} />
      ) : (
        <AddNodesScreen graphData={graphData} onGraphUpdate={saveGraphData} />
      )}
    </div>
  );
}

export default App;
