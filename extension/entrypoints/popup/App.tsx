import { useState, useEffect } from 'react';
import './App.css';
import { GraphData } from '@/types/graph';
import { getCurrentPageState, saveCurrentPageState } from '@/utils/eventStorage';
import AddNodesScreen from './AddNodesScreen.tsx';
import VisualizationScreen from './VisualizationScreen.tsx';

type Screen = 'add' | 'visualize';

function App() {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('visualize');
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [{ id: 'root', label: 'Root' }],
    links: [],
  });

  useEffect(() => {
    const initialize = async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id && tab.url) {
        console.log('Tab URL:', tab.url);
        // First check if tab URL is a polymarket event page
        const isEventPage = tab.url.includes('polymarket.com/event/');
        console.log('Is event page:', isEventPage);
        if (isEventPage) {
          setPageUrl(tab.url);
        } else {
          setPageUrl(null);
          return;
        }
        try{
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

  if (loading) {
    return (
      <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px' }}>
        <p>Loading...</p>
      </div>
    );
  }
  console.log('Page URL:', pageUrl);
  if (!pageUrl) {
    return (
      <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px' }}>
        <h2>Polyindex</h2>
        <p>Inactive - Navigate to a Polymarket event page</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', minWidth: '600px', minHeight: '500px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Polyindex</h2>
        <button onClick={() => setCurrentScreen('visualize')}>Visualize</button>
        <button onClick={() => setCurrentScreen('add')}>Add Nodes</button>
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
