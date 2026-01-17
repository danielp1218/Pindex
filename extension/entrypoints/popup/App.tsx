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
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [{ id: 'root', label: 'Root' }],
    links: [],
  });

  useEffect(() => {
    const initialize = async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id && tab.url) {
        console.log('Tab URL:', tab.url);
        const isEventPage = tab.url.includes('polymarket.com/event/');
        console.log('Is event page:', isEventPage);
        if (isEventPage) {
          setPageUrl(tab.url);
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
      <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px', background: '#0a0f1a', color: '#e2e8f0' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!pageUrl) {
    return (
      <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px', background: '#0a0f1a', color: '#e2e8f0' }}>
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
        onViewNodes={() => setCurrentScreen('visualize')}
      />
    );
  }

  // Nodes screens
  return (
    <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px', background: '#0a0f1a', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={() => setCurrentScreen('decision')}
          style={{ 
            background: '#1e293b', 
            color: '#e2e8f0', 
            border: '1px solid #334155',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, flex: 1 }}>Polyindex</h2>
        <button 
          onClick={() => setCurrentScreen('visualize')}
          style={{ 
            background: currentScreen === 'visualize' ? '#3b82f6' : '#1e293b', 
            color: '#e2e8f0', 
            border: '1px solid #334155',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
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
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
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
