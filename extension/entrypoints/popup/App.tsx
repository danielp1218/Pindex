import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { getDependencyState, getEventIdFromUrl, type DependencyQueueItem } from '@/utils/eventStorage';
import { processDependencyDecisionInBackground } from '@/utils/dependencyWorker';
import type { GraphData, BetRelationship } from '@/types/graph';
import type { RelationGraphNode } from '@/types/relationGraph';
import {
  addQueueItemToGraph,
  createRootGraph,
  flattenGraph,
  graphToGraphData,
  loadRelationGraph,
  saveRelationGraph,
  updateNodeImage,
  updateNodeFromSource,
  updateRootMetadata,
} from '@/utils/relationGraph';
import {
  computeOutcomeDelta,
  fetchGraphOutcomes,
  type GraphOutcomeResult,
  type GraphOutcomeDelta,
} from '@/utils/globalsApi';
import { fetchEventInfoFromUrl, type PolymarketEventInfo } from '@/utils/polymarketClient';
import DecisionScreen from './DecisionScreen.tsx';
import AddNodesScreen from './AddNodesScreen.tsx';
import VisualizationScreen from './VisualizationScreen.tsx';
import IntroScreen from './IntroScreen.tsx';
import { VideoLoader } from '../overlay/VideoLoader';

type Screen = 'intro' | 'decision' | 'add' | 'visualize';

function findNodeById(node: RelationGraphNode, id: string): RelationGraphNode | null {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function App() {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('intro');
  const [userSelection, setUserSelection] = useState<'yes' | 'no' | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [marketImageUrl, setMarketImageUrl] = useState<string | null>(null);
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(null);
  const [relationGraph, setRelationGraph] = useState<RelationGraphNode | null>(null);
  const [dependencyQueue, setDependencyQueue] = useState<DependencyQueueItem[]>([]);
  const [dependencyVisited, setDependencyVisited] = useState<string[]>([]);
  const [rootInfo, setRootInfo] = useState<PolymarketEventInfo | null>(null);
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [globalsBaseline, setGlobalsBaseline] = useState<GraphOutcomeResult | null>(null);
  const [globalsCandidate, setGlobalsCandidate] = useState<GraphOutcomeResult | null>(null);
  const [globalsDelta, setGlobalsDelta] = useState<GraphOutcomeDelta | null>(null);
  const [globalsError, setGlobalsError] = useState<string | null>(null);
  const [globalsLoading, setGlobalsLoading] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const [graphHover, setGraphHover] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const imageFetchRef = useRef(new Set<string>());

  const rootId = useMemo(
    () => (pageUrl ? getEventIdFromUrl(pageUrl) ?? 'root' : 'root'),
    [pageUrl]
  );
  const queuedItem = dependencyQueue[0] ?? null;
  const hasVisitedRoot = useMemo(
    () => dependencyVisited.some(url => getEventIdFromUrl(url) === rootId),
    [dependencyVisited, rootId]
  );
  const fallbackTitle = useMemo(() => {
    if (!pageUrl) return 'Market Decision';
    const slug = pageUrl.split('/event/')[1]?.split('?')[0] || '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Market Decision';
  }, [pageUrl]);
  const eventTitle = rootInfo?.question ?? fallbackTitle;
  const rootDecision = userSelection ?? 'yes';
  const rootFallbackItem = useMemo<DependencyQueueItem | null>(() => {
    if (!pageUrl || hasVisitedRoot) {
      return null;
    }
    return {
      id: rootId,
      url: pageUrl,
      weight: 1,
      decision: rootDecision,
      relation: '',
      question: eventTitle,
    };
  }, [pageUrl, hasVisitedRoot, rootId, rootDecision, eventTitle]);
  const displayItem = queuedItem ?? rootFallbackItem;
  const queueEmpty = !displayItem && hasVisitedRoot;
  const decisionDisabled = isProcessingDecision || !displayItem || !relationGraph;

  const graphView = useMemo<GraphData>(() => {
    if (!relationGraph) {
      return { nodes: [], links: [] };
    }
    return graphToGraphData(relationGraph);
  }, [relationGraph]);

  const miniGraphData = useMemo(() => {
    if (!relationGraph || !displayItem) {
      return null;
    }

    const targetLabel = displayItem.question ?? displayItem.id;
    const hasSource = Boolean(displayItem.sourceQuestion || displayItem.parentId);

    const createAbbreviation = (label: string) => {
      const words = label.split(/\s+/).filter(word => word.length > 2);
      const parts = (words.length > 0 ? words : label.split(/\s+/)).slice(0, 2);
      const abbrev = parts.map(word => word[0]?.toUpperCase()).join('');
      return abbrev || label.slice(0, 2).toUpperCase();
    };

    const targetNode = {
      id: displayItem.id,
      label: createAbbreviation(targetLabel),
      fullLabel: targetLabel,
      x: hasSource ? 270 : 170,
      y: 55,
    };

    if (!hasSource) {
      return {
        nodes: [targetNode],
        links: [],
        sourceLabel: '',
        targetLabel,
        reasoning: displayItem.explanation ?? '',
        sourceImageUrl: undefined,
      };
    }

    const sourceNode = displayItem.parentId
      ? findNodeById(relationGraph, displayItem.parentId) ?? relationGraph
      : relationGraph;
    const sourceLabel = displayItem.sourceQuestion ?? sourceNode.label ?? sourceNode.id;

    return {
      nodes: [
        {
          id: sourceNode.id,
          label: createAbbreviation(sourceLabel),
          fullLabel: sourceLabel,
          x: 70,
          y: 55,
          imageUrl: sourceNode.imageUrl,
        },
        targetNode,
      ],
      links: [
        {
          source: sourceNode.id,
          target: displayItem.id,
          relationship: displayItem.relation as BetRelationship,
          reasoning: displayItem.explanation,
        },
      ],
      sourceLabel,
      targetLabel,
      reasoning: displayItem.explanation ?? '',
      sourceImageUrl: sourceNode.imageUrl,
    };
  }, [relationGraph, displayItem]);

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
          // Only set pageUrl if not already set (to avoid re-initialization)
          if (!pageUrl) {
            setPageUrl(tab.url);
          }

          // Extract event title from URL for root node
          const slug = tab.url.split('/event/')[1]?.split('?')[0] || '';
          const eventTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Market';

          // Always start with intro screen - don't load hasStarted from storage
          // The intro screen is shown every time the popup opens
          setHasStarted(false);
          setCurrentScreen('intro');

          let currentMarketImageUrl: string | null = null;
          let selection: 'yes' | 'no' | null = userSelection;

          // Also try to get selection and images from content script
          try {
            const response = await browser.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
            if (response?.userSelection) {
              setUserSelection(response.userSelection);
              selection = response.userSelection;
            }
            if (response?.profileImage) {
              setProfileImage(response.profileImage);
            }
            if (response?.marketImageUrl) {
              currentMarketImageUrl = response.marketImageUrl;
              setMarketImageUrl(response.marketImageUrl);
            } else if (response?.profileImage) {
              // Use profileImage as marketImageUrl if marketImageUrl not provided
              currentMarketImageUrl = response.profileImage;
              setMarketImageUrl(response.profileImage);
            }
          } catch (error) {
            console.error('Error getting page info:', error);
          }

          // Only load graph and do heavy API calls if user has started
          if (hasStarted) {
            try {
              // Try to load existing graph first
              const graph = await loadRelationGraph({
                url: tab.url,
                title: eventTitle,
                imageUrl: currentMarketImageUrl || undefined,
                decision: selection ?? undefined,
              });
              setRelationGraph(graph);
            } catch (error) {
              console.error('Error loading relation graph:', error);
              // Create fresh graph for new analysis
              const graph = createRootGraph({
                url: tab.url,
                title: eventTitle,
                imageUrl: currentMarketImageUrl || undefined,
                decision: selection ?? undefined,
              });
              setRelationGraph(graph);
              await saveRelationGraph(tab.url, graph);
            }
          } else {
            // If not started, just set loading to false to show intro screen
            setLoading(false);
          }
        } else {
          setPageUrl(null);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    };

    initialize();
  }, [hasStarted, pageUrl]);

  useEffect(() => {
    if (!pageUrl) {
      return;
    }

    let isActive = true;

    const loadQueue = async () => {
      const state = await getDependencyState(pageUrl);
      if (isActive) {
        setDependencyQueue(state.queue);
        setDependencyVisited(state.visited);
      }
    };

    loadQueue();

    const handleChange = () => {
      void loadQueue();
    };

    browser.storage.onChanged.addListener(handleChange);
    return () => {
      isActive = false;
      browser.storage.onChanged.removeListener(handleChange);
    };
  }, [pageUrl]);

  useEffect(() => {
    if (!pageUrl) {
      return;
    }

    let isActive = true;
    const loadRootInfo = async () => {
      const info = await fetchEventInfoFromUrl(pageUrl);
      if (isActive) {
        setRootInfo(info);
        if (info?.imageUrl) {
          setEventImageUrl(info.imageUrl);
        }
      }
    };

    void loadRootInfo();
    return () => {
      isActive = false;
    };
  }, [pageUrl]);

  useEffect(() => {
    if (!pageUrl || !relationGraph) {
      return;
    }

    const nextGraph = updateRootMetadata(relationGraph, {
      title: eventTitle,
      imageUrl: eventImageUrl || marketImageUrl || profileImage || undefined,
      decision: userSelection ?? undefined,
    });

    if (nextGraph !== relationGraph) {
      setRelationGraph(nextGraph);
      void saveRelationGraph(pageUrl, nextGraph);
    }
  }, [pageUrl, relationGraph, eventImageUrl, marketImageUrl, profileImage, userSelection, eventTitle]);

  useEffect(() => {
    if (!pageUrl || !relationGraph) {
      return;
    }

    let isActive = true;
    const nodesNeedingImages = flattenGraph(relationGraph)
      .filter(node => node.url && !node.imageUrl)
      .filter(node => !imageFetchRef.current.has(node.url as string));

    if (nodesNeedingImages.length === 0) {
      return;
    }

    const hydrateImages = async () => {
      let nextGraph = relationGraph;

      for (const node of nodesNeedingImages) {
        const url = node.url as string;
        imageFetchRef.current.add(url);
        const info = await fetchEventInfoFromUrl(url);
        if (!isActive) {
          return;
        }
        if (info?.imageUrl) {
          nextGraph = updateNodeImage(nextGraph, node.id, info.imageUrl);
        }
      }

      if (nextGraph !== relationGraph && isActive) {
        setRelationGraph(nextGraph);
        await saveRelationGraph(pageUrl, nextGraph);
      }
    };

    void hydrateImages();
    return () => {
      isActive = false;
    };
  }, [pageUrl, relationGraph]);

  useEffect(() => {
    if (!relationGraph) {
      setGlobalsBaseline(null);
      setGlobalsCandidate(null);
      setGlobalsDelta(null);
      return;
    }

    let isActive = true;

    const loadGlobals = async () => {
      setGlobalsLoading(true);
      setGlobalsError(null);

      try {
        const baselineGraph = relationGraph;
        const baseline = await fetchGraphOutcomes(baselineGraph);

        let candidate: GraphOutcomeResult | null = null;
        if (queuedItem) {
          const candidateGraph = addQueueItemToGraph(
            relationGraph,
            queuedItem,
            relationGraph.id
          );
          candidate = await fetchGraphOutcomes(candidateGraph);
        }

        if (!isActive) {
          return;
        }

        setGlobalsBaseline(baseline);
        setGlobalsCandidate(candidate ?? baseline);
        setGlobalsDelta(queuedItem && candidate ? computeOutcomeDelta(baseline, candidate) : null);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setGlobalsError((error as Error).message || 'Failed to fetch globals.');
        setGlobalsBaseline(null);
        setGlobalsCandidate(null);
        setGlobalsDelta(null);
      } finally {
        if (isActive) {
          setGlobalsLoading(false);
        }
      }
    };

    void loadGlobals();
    return () => {
      isActive = false;
    };
  }, [relationGraph, queuedItem]);

  const handleDecision = async (accept: boolean, risk: number) => {
    if (!pageUrl || !relationGraph || isProcessingDecision) {
      return;
    }

    setIsProcessingDecision(true);
    const selectedItem = queuedItem ?? rootFallbackItem;
    const isRootFallback = Boolean(selectedItem && !queuedItem);

    let nextGraph = relationGraph;
    if (accept && selectedItem && !isRootFallback) {
      nextGraph = addQueueItemToGraph(relationGraph, selectedItem, relationGraph.id);
    }

    try {
      const result = await processDependencyDecisionInBackground({
        eventUrl: pageUrl,
        keep: accept,
        fallbackDecision: selectedItem?.decision ?? rootDecision,
        fallbackWeight: selectedItem?.weight ?? 1,
        risk,
      });

      setDependencyQueue(result.queue);
      setDependencyVisited(result.visited);

      if (accept) {
        const targetId = selectedItem?.id ?? rootId;
        nextGraph = updateNodeFromSource(
          nextGraph,
          targetId,
          result.response?.sourceMarket,
          selectedItem?.decision
        );
      }

      if (nextGraph !== relationGraph) {
        setRelationGraph(nextGraph);
        await saveRelationGraph(pageUrl, nextGraph);
      }

      // Decision processed - stay on decision screen for next dependency
      // The intro screen will show again on next popup open
    } catch (error) {
      console.error('Failed to process decision', error);
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const saveGraphData = async (newGraph: RelationGraphNode) => {
    setRelationGraph(newGraph);
    if (pageUrl) {
      await saveRelationGraph(pageUrl, newGraph);
    }
  };

  // Handle start action - trigger API calls and show loading
  const handleStart = async () => {
    if (!pageUrl) {
      // If pageUrl not set yet, get it first
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.url && tab.url.includes('polymarket.com/event/')) {
        setPageUrl(tab.url);
        setHasStarted(true);
        setCurrentScreen('decision');
        setLoading(true);
        return;
      }
      return;
    }
    
    // Start the analysis
    setHasStarted(true);
    setCurrentScreen('decision');
    setLoading(true);
    
    // Reset graph state to trigger fresh API calls
    setRelationGraph(null);
    setDependencyQueue([]);
    setDependencyVisited([]);
    
    // The existing initialization logic will run via useEffect when hasStarted changes
  };

  // Handle not now - close popup
  const handleNotNow = () => {
    window.close();
  };

  // Show VideoLoader only when user has started (clicked "Start Pindex")
  if (loading && hasStarted) {
    return (
      <div style={{ 
        minWidth: '420px', 
        minHeight: '600px', 
        background: 'linear-gradient(145deg, #0f1520 0%, #0a0e16 50%, #080c12 100%)', 
        color: '#e2e8f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <VideoLoader size={200} />
      </div>
    );
  }

  // Show intro screen when we have pageUrl but user hasn't started yet
  // This takes priority over the loading state
  if (pageUrl && !hasStarted) {
    return (
      <IntroScreen
        eventTitle={eventTitle}
        profileImage={eventImageUrl || marketImageUrl || profileImage}
        onStart={handleStart}
        onNotNow={handleNotNow}
      />
    );
  }

  // Only show loading for initial page detection (before we know if it's a Polymarket page)
  if (loading) {
    return (
      <div style={{ minWidth: '420px', minHeight: '600px', background: '#0a0f1a', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!pageUrl) {
    return (
      <div style={{ 
        padding: '32px 24px', 
        minWidth: '320px', 
        minHeight: '200px', 
        background: 'linear-gradient(145deg, #0f1520 0%, #0a0e16 50%, #080c12 100%)', 
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        </div>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          margin: 0,
          color: '#f1f5f9',
        }}>PolyIndex</h2>
        <p style={{ 
          fontSize: '13px', 
          color: '#64748b', 
          margin: 0,
          lineHeight: 1.5,
        }}>Navigate to a Polymarket event to get started</p>
        <a 
          href="https://polymarket.com" 
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: '8px',
            padding: '10px 20px',
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          Open Polymarket
        </a>
      </div>
    );
  }

  // Decision Screen (main)
  if (currentScreen === 'decision') {
    if (queueEmpty) {
      return (
        <div style={{
          minWidth: '420px',
          minHeight: '600px',
          background: '#0a0f1a',
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', letterSpacing: '0.4px' }}>
            calculating...
          </span>
        </div>
      );
    }
    return (
      <DecisionScreen
        eventTitle={displayItem?.question ?? eventTitle}
        userSelection={userSelection}
        profileImage={eventImageUrl || marketImageUrl || profileImage}
        onViewNodes={() => setCurrentScreen('visualize')}
        onDecision={handleDecision}
        isProcessing={decisionDisabled}
        hasDecisionTarget={Boolean(displayItem)}
        miniGraphData={miniGraphData}
        showUserSelection={Boolean(rootFallbackItem && !queuedItem)}
        globalsBaseline={globalsBaseline}
        globalsCandidate={globalsCandidate}
        globalsDelta={globalsDelta}
        globalsLoading={globalsLoading}
        globalsError={globalsError}
      />
    );
  }

  // Nodes screens
  return (
    <div style={{ padding: '16px 20px', width: '420px', minWidth: '420px', maxWidth: '420px', height: '600px', maxHeight: '600px', background: '#0a0f1a', color: '#e2e8f0', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setCurrentScreen('decision')}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
            color: '#e2e8f0',
            border: backHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: backHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
            filter: backHover ? 'brightness(1.25)' : 'brightness(1)',
          }}
        >
          Back
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCurrentScreen('visualize')}
          onMouseEnter={() => setGraphHover(true)}
          onMouseLeave={() => setGraphHover(false)}
          style={{
            background: currentScreen === 'visualize' 
              ? 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)' 
              : graphHover 
                ? 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)'
                : 'transparent',
            color: currentScreen === 'visualize' || graphHover ? '#e2e8f0' : '#64748b',
            border: currentScreen === 'visualize' || graphHover 
              ? '1px solid rgba(255, 255, 255, 0.3)' 
              : '1px solid transparent',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: graphHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : currentScreen === 'visualize' ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
            filter: graphHover && currentScreen !== 'visualize' ? 'brightness(1.25)' : 'brightness(1)',
          }}
        >
          Graph
        </button>
        <button
          onClick={() => setCurrentScreen('add')}
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          style={{
            background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
            color: '#e2e8f0',
            border: addHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            boxShadow: addHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
            filter: addHover ? 'brightness(1.25)' : 'brightness(1)',
          }}
        >
          Add
        </button>
      </div>
      
      {currentScreen === 'visualize' ? (
        <VisualizationScreen graphData={graphView} />
      ) : (
        <AddNodesScreen
          relationGraph={relationGraph ?? createRootGraph({ url: pageUrl ?? 'root' })}
          onGraphUpdate={saveGraphData}
          marketImageUrl={eventImageUrl || marketImageUrl || profileImage}
        />
      )}
    </div>
  );
}

export default App;
