import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import { VideoLoader } from './VideoLoader';
import { getRelationshipColor, type BetRelationship, type GraphData } from '@/types/graph';
import { getDependencyState, getEventIdFromUrl, type DependencyQueueItem } from '@/utils/eventStorage';
import { processDependencyDecisionInBackground } from '@/utils/dependencyWorker';
import type { RelationGraphNode } from '@/types/relationGraph';
import {
  addChildNode,
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
import { fetchEventInfoFromUrl } from '@/utils/polymarketClient';

interface OverlayAppProps {
  isVisible: boolean;
  onClose: () => void;
  profileImage?: string | null;
}

type Screen = 'intro' | 'decision' | 'visualize' | 'add';

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

// Reusable button styles matching landing page
const buttonBase: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '7px',
  fontWeight: 500,
  fontSize: '11px',
  cursor: 'pointer',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
  color: '#e2e8f0',
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
};

export function OverlayApp({ isVisible, onClose, profileImage: initialProfileImage }: OverlayAppProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('intro');
  const [userSelection, setUserSelection] = useState<'yes' | 'no' | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(initialProfileImage || null);
  const [eventImageUrl, setEventImageUrl] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('Market Decision');
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [riskLevel, setRiskLevel] = useState(50);
  
  // Add screen state - moved to top level to prevent re-render issues
  const [newNodeLabel, setNewNodeLabel] = useState('');
  
  // Hover states
  const [viewNodesHover, setViewNodesHover] = useState(false);
  const [acceptBtnHover, setAcceptBtnHover] = useState(false);
  const [rejectBtnHover, setRejectBtnHover] = useState(false);
  const [riskHover, setRiskHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const [addBtnHover, setAddBtnHover] = useState(false);
  const [startHover, setStartHover] = useState(false);
  const [notNowHover, setNotNowHover] = useState(false);

  const [relationGraph, setRelationGraph] = useState<RelationGraphNode | null>(null);
  const [dependencyQueue, setDependencyQueue] = useState<DependencyQueueItem[]>([]);
  const [dependencyVisited, setDependencyVisited] = useState<string[]>([]);
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [globalsBaseline, setGlobalsBaseline] = useState<GraphOutcomeResult | null>(null);
  const [globalsCandidate, setGlobalsCandidate] = useState<GraphOutcomeResult | null>(null);
  const [globalsDelta, setGlobalsDelta] = useState<GraphOutcomeDelta | null>(null);
  const [globalsError, setGlobalsError] = useState<string | null>(null);
  const [globalsLoading, setGlobalsLoading] = useState(false);
  const [displayItemImage, setDisplayItemImage] = useState<string | null>(null);
  const [sourceItemImage, setSourceItemImage] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const vizSvgRef = useRef<SVGSVGElement>(null);
  const vizTooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageFetchRef = useRef(new Set<string>());

  // Get current page URL for API
  const currentUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/event/')) {
      return window.location.href;
    }
    return null;
  }, [isVisible]);

  const displayImage = eventImageUrl || profileImage;

  const rootId = useMemo(
    () => (currentUrl ? getEventIdFromUrl(currentUrl) ?? 'root' : 'root'),
    [currentUrl]
  );
  const queuedItem = dependencyQueue[0] ?? null;
  const hasVisitedRoot = useMemo(
    () => dependencyVisited.some(url => getEventIdFromUrl(url) === rootId),
    [dependencyVisited, rootId]
  );
  const rootDecision = userSelection ?? 'yes';
  const rootFallbackItem = useMemo<DependencyQueueItem | null>(() => {
    if (!currentUrl || hasVisitedRoot) {
      return null;
    }
    return {
      id: rootId,
      url: currentUrl,
      weight: 1,
      decision: rootDecision,
      relation: '',
      question: eventTitle,
    };
  }, [currentUrl, hasVisitedRoot, rootId, rootDecision, eventTitle]);
  const displayItem = queuedItem ?? rootFallbackItem;
  const showUserSelection = Boolean(rootFallbackItem && !queuedItem);
  const decisionTitle = displayItem?.question ?? eventTitle;
  
  // Show loader until we have FULL dependency data (with explanation/source), not just root fallback
  const hasFullDependencyData = queuedItem && (queuedItem.explanation || queuedItem.sourceQuestion);
  const showLoader = isLoading || isProcessingDecision || (currentScreen === 'decision' && !hasFullDependencyData && !hasVisitedRoot);
  const queueEmpty = currentScreen === 'decision' && !displayItem && hasVisitedRoot;
  const decisionDisabled = isProcessingDecision || !displayItem || !relationGraph;
  const hasDecisionTarget = Boolean(displayItem);

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
      imageUrl: displayItem.imageUrl || displayItemImage,
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
          imageUrl: sourceNode.imageUrl || sourceItemImage,
        },
        targetNode,
      ],
      links: [
        {
          source: displayItem.id,
          target: sourceNode.id,
          relationship: displayItem.relation as BetRelationship,
          reasoning: displayItem.explanation,
        },
      ],
      sourceLabel,
      targetLabel,
      reasoning: displayItem.explanation ?? '',
      sourceImageUrl: sourceNode.imageUrl || sourceItemImage,
    };
  }, [relationGraph, displayItem, displayItemImage, sourceItemImage]);

  useEffect(() => {
    setAccepted(null);
  }, [displayItem?.id]);

  // Reset state when overlay opens - always show intro screen first
  useEffect(() => {
    if (isVisible) {
      setHasStarted(false);
      setCurrentScreen('intro');
      setIsLoading(false);
      setRelationGraph(null);
    }
  }, [isVisible]);

  // Update profile image when prop changes
  useEffect(() => {
    if (initialProfileImage) {
      setProfileImage(initialProfileImage);
    }
  }, [initialProfileImage]);

  // Extract event info from URL (basic info for intro screen)
  useEffect(() => {
    if (!isVisible || !currentUrl) {
      return;
    }

    const slug = currentUrl.split('/event/')[1]?.split('?')[0] || '';
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Market';
    setEventTitle(title);

    // Get user selection from storage
    (async () => {
      try {
        const stored = await browser.storage.local.get(['lastUserSelection', 'selectionTimestamp']);
        if (stored.lastUserSelection && typeof stored.selectionTimestamp === 'number') {
          const age = Date.now() - stored.selectionTimestamp;
          if (age < 30000 && (stored.lastUserSelection === 'yes' || stored.lastUserSelection === 'no')) {
            setUserSelection(stored.lastUserSelection);
          }
        }
      } catch (e) {
        console.error('Error getting stored selection:', e);
      }
    })();
  }, [isVisible, currentUrl]);

  // Load relation graph only after user starts, then auto-accept root decision
  useEffect(() => {
    if (!isVisible || !hasStarted || !currentUrl) {
      return;
    }

    let isActive = true;

    const loadGraphAndProcessRoot = async () => {
      // Stay on loading screen (don't change currentScreen yet)
      setIsLoading(true);
      
      // Track start time for minimum loading duration
      const startTime = Date.now();
      const MIN_LOADING_TIME = 4000; // Minimum 4 seconds of loading animation

      let loadedGraph: RelationGraphNode | null = null;

      try {
        loadedGraph = await loadRelationGraph({
          url: currentUrl,
          title: eventTitle,
          imageUrl: eventImageUrl || profileImage || undefined,
          decision: userSelection ?? undefined,
        });
        if (isActive) {
          setRelationGraph(loadedGraph);
        }
      } catch (error) {
        console.error('Error loading relation graph:', error);
        loadedGraph = createRootGraph({
          url: currentUrl,
          title: eventTitle,
          imageUrl: eventImageUrl || profileImage || undefined,
          decision: userSelection ?? undefined,
        });
        if (isActive) {
          setRelationGraph(loadedGraph);
        }
        await saveRelationGraph(currentUrl, loadedGraph);
      }

      // After graph loads, automatically accept the root decision and search for dependencies
      if (isActive && loadedGraph) {
        try {
          // Small delay to ensure queue state is initialized
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Get the root fallback item (the current market)
          const rootDecision = userSelection ?? 'yes';
          
          // Process the root decision as accepted to start dependency search
          const result = await processDependencyDecisionInBackground({
            eventUrl: currentUrl,
            keep: true, // Accept the root decision
            fallbackDecision: rootDecision,
            fallbackWeight: 1,
            risk: riskLevel,
          });

          if (isActive) {
            // Check if we have actual dependency data with full details (explanation, source, etc.)
            const firstItem = result.queue[0];
            const hasFullData = firstItem && (firstItem.explanation || firstItem.sourceQuestion);
            
            if (hasFullData) {
              // We have full dependency data! Update state and show decision screen
              setDependencyQueue(result.queue);
              setDependencyVisited(result.visited);
              
              // Wait for state to be applied
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Ensure minimum loading time
              const elapsed = Date.now() - startTime;
              if (elapsed < MIN_LOADING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
              }
              
              setIsLoading(false);
              setCurrentScreen('decision');
            } else if (result.queue.length > 0) {
              // We have queue items but not full data - update queue but keep loading
              // This shouldn't normally happen, but handle it gracefully
              setDependencyQueue(result.queue);
              setDependencyVisited(result.visited);
              
              const elapsed = Date.now() - startTime;
              if (elapsed < MIN_LOADING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
              }
              
              setIsLoading(false);
              setCurrentScreen('decision');
            } else {
              // No dependencies found - show root fallback after minimum time
              setDependencyVisited(result.visited);
              
              const elapsed = Date.now() - startTime;
              if (elapsed < MIN_LOADING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
              }
              
              setIsLoading(false);
              setCurrentScreen('decision');
            }
          }
        } catch (error) {
          console.error('Error processing root decision:', error);
          // On error, keep loading longer then show what we have
          if (isActive) {
            const elapsed = Date.now() - startTime;
            const errorWaitTime = Math.max(MIN_LOADING_TIME, 5000); // Wait at least 5 seconds on error
            if (elapsed < errorWaitTime) {
              await new Promise(resolve => setTimeout(resolve, errorWaitTime - elapsed));
            }
            setIsLoading(false);
            setCurrentScreen('decision');
          }
        }
      } else if (isActive) {
        // If graph didn't load, ensure minimum loading time
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_LOADING_TIME) {
          await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
        }
        setIsLoading(false);
        setCurrentScreen('decision');
      }
    };

    void loadGraphAndProcessRoot();
    return () => {
      isActive = false;
    };
  // Note: eventImageUrl and profileImage removed from deps to prevent race condition
  // when accepting nodes. Root metadata is updated by separate effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, hasStarted, currentUrl]);

  useEffect(() => {
    if (!currentUrl) {
      return;
    }

    let isActive = true;

    const loadQueue = async () => {
      const state = await getDependencyState(currentUrl);
      if (isActive) {
        setDependencyQueue(state.queue);
        setDependencyVisited(state.visited);
      }
    };

    void loadQueue();

    const handleChange = () => {
      void loadQueue();
    };

    browser.storage.onChanged.addListener(handleChange);
    return () => {
      isActive = false;
      browser.storage.onChanged.removeListener(handleChange);
    };
  }, [currentUrl]);

  useEffect(() => {
    if (!currentUrl) {
      return;
    }

    let isActive = true;
    const loadRootInfo = async () => {
      const info = await fetchEventInfoFromUrl(currentUrl);
      if (isActive) {
        if (info?.question) {
          setEventTitle(info.question);
        }
        if (info?.imageUrl) {
          setEventImageUrl(info.imageUrl);
        }
      }
    };

    void loadRootInfo();
    return () => {
      isActive = false;
    };
  }, [currentUrl]);

  useEffect(() => {
    if (!currentUrl || !relationGraph) {
      return;
    }

    const nextGraph = updateRootMetadata(relationGraph, {
      title: eventTitle,
      imageUrl: eventImageUrl || profileImage || undefined,
      decision: userSelection ?? undefined,
    });

    if (nextGraph !== relationGraph) {
      setRelationGraph(nextGraph);
      void saveRelationGraph(currentUrl, nextGraph);
    }
  }, [currentUrl, relationGraph, eventTitle, eventImageUrl, profileImage, userSelection]);

  useEffect(() => {
    if (!currentUrl || !relationGraph) {
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
        await saveRelationGraph(currentUrl, nextGraph);
      }
    };

    void hydrateImages();
    return () => {
      isActive = false;
    };
  }, [currentUrl, relationGraph]);

  // Fetch image for current displayItem if missing
  useEffect(() => {
    if (!displayItem?.url || displayItem.imageUrl) {
      // Reset if no displayItem or already has image
      if (!displayItem) {
        setDisplayItemImage(null);
      }
      return;
    }

    let isActive = true;
    setDisplayItemImage(null);

    const fetchImage = async () => {
      const info = await fetchEventInfoFromUrl(displayItem.url);
      if (isActive && info?.imageUrl) {
        setDisplayItemImage(info.imageUrl);
      }
    };

    void fetchImage();
    return () => {
      isActive = false;
    };
  }, [displayItem?.id, displayItem?.url, displayItem?.imageUrl]);

  // Fetch image for source node if missing
  useEffect(() => {
    const sourceUrl = displayItem?.sourceUrl || displayItem?.parentUrl;
    if (!sourceUrl) {
      setSourceItemImage(null);
      return;
    }

    // Check if we already have the image from the relation graph
    const sourceNode = displayItem?.parentId && relationGraph
      ? findNodeById(relationGraph, displayItem.parentId)
      : relationGraph;

    if (sourceNode?.imageUrl) {
      setSourceItemImage(null); // Use graph's image
      return;
    }

    let isActive = true;
    setSourceItemImage(null);

    const fetchImage = async () => {
      const info = await fetchEventInfoFromUrl(sourceUrl);
      if (isActive && info?.imageUrl) {
        setSourceItemImage(info.imageUrl);
      }
    };

    void fetchImage();
    return () => {
      isActive = false;
    };
  }, [displayItem?.parentId, displayItem?.sourceUrl, displayItem?.parentUrl, relationGraph]);

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

  // D3 Mini Graph Effect (for decision screen)
  useEffect(() => {
    if (!isVisible || isLoading || currentScreen !== 'decision' || !miniGraphData) return;

    let simulation: d3.Simulation<any, undefined> | null = null;

    // Small delay to ensure DOM is mounted after loading completes
    const timeoutId = setTimeout(() => {
      if (!svgRef.current) return;

      const width = 320;
      const height = 90;

      d3.select(svgRef.current).selectAll('*').remove();

      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .attr('style', 'background: transparent; overflow: visible;');

      const g = svg.append('g');

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      const nodes = miniGraphData.nodes.map(d => ({ ...d }));
      const links = miniGraphData.links
        .map(d => {
          const source = nodes.find(node => node.id === d.source) ?? nodes[0];
          const target = nodes.find(node => node.id === d.target) ?? nodes[nodes.length - 1];
          if (!source || !target) {
            return null;
          }
          return { ...d, source, target };
        })
        .filter(Boolean) as Array<any>;

      const nodeRadius = 16;
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).distance(200))
        .alphaDecay(0.05);

      // Add defs for clip path and arrow markers
      const defs = svg.append('defs');
      defs.append('clipPath')
        .attr('id', 'miniCircleClip')
        .append('circle')
        .attr('r', nodeRadius - 2)
        .attr('cx', 0)
        .attr('cy', 0);

      // Add arrow markers for each relationship color in mini graph
      const miniColors = ['#4a7c6f', '#8b5c5c', '#5c7a9e', '#7a6b8a', '#8a7a5c', '#64748b'];
      miniColors.forEach((color, i) => {
        defs.append('marker')
          .attr('id', `mini-arrow-${i}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', nodeRadius + 8)
          .attr('refY', 0)
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .attr('orient', 'auto')
          .append('path')
          .attr('fill', color)
          .attr('d', 'M0,-5L10,0L0,5');
      });

      const miniColorToMarkerId = (color: string) => {
        const index = miniColors.indexOf(color);
        return index >= 0 ? `mini-arrow-${index}` : 'mini-arrow-5';
      };

      // Draw link with relationship color and arrow
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', (d: any) => getRelationshipColor(d.relationship))
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 2)
        .attr('marker-end', (d: any) => `url(#${miniColorToMarkerId(getRelationshipColor(d.relationship))})`);

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .style('cursor', 'grab')
        .call(d3.drag<any, any>()
          .on('start', (event, d: any) => {
            if (!event.active) simulation?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d: any) => {
            if (!event.active) simulation?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
        );

      // Render nodes with images if available, otherwise circle with text
      node.each(function(d: any) {
        const nodeGroup = d3.select(this);
        
        if (d.imageUrl) {
          // Clipped image node
          nodeGroup.append('image')
            .attr('href', d.imageUrl)
            .attr('width', (nodeRadius - 2) * 2)
            .attr('height', (nodeRadius - 2) * 2)
            .attr('x', -(nodeRadius - 2))
            .attr('y', -(nodeRadius - 2))
            .attr('clip-path', 'url(#miniCircleClip)')
            .attr('preserveAspectRatio', 'xMidYMid slice');
        } else {
          // Fallback circle with text
          nodeGroup.append('circle')
            .attr('r', nodeRadius)
            .attr('fill', '#1e293b')
            .attr('stroke', '#334155')
            .attr('stroke-width', 1);
          
          nodeGroup.append('text')
            .text(d.label)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#64748b')
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .attr('pointer-events', 'none');
        }
      });

      const tooltip = d3.select(tooltipRef.current);
      node
        .on('mouseenter', (event: MouseEvent, d: any) => {
          tooltip
            .style('opacity', '1')
            .style('left', `${event.offsetX + 15}px`)
            .style('top', `${event.offsetY - 5}px`)
            .text(d.fullLabel);
        })
        .on('mousemove', (event: MouseEvent) => {
          tooltip
            .style('left', `${event.offsetX + 15}px`)
            .style('top', `${event.offsetY - 5}px`);
        })
        .on('mouseleave', () => {
          tooltip.style('opacity', '0');
        });

      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source?.x ?? 0)
          .attr('y1', (d: any) => d.source?.y ?? 0)
          .attr('x2', (d: any) => d.target?.x ?? 0)
          .attr('y2', (d: any) => d.target?.y ?? 0);

        node.attr('transform', (d: any) => {
          const x = d.x ?? 0;
          const y = d.y ?? 0;
          return `translate(${x},${y})`;
        });
      });
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      simulation?.stop();
    };
  }, [isVisible, isLoading, currentScreen, miniGraphData]);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return value.toFixed(decimals);
  };

  const formatSigned = (value: number, formatter: (val: number) => string) => {
    if (!Number.isFinite(value)) {
      return '—';
    }
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${formatter(Math.abs(value))}`;
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  const getDeltaColor = (value: number) => {
    if (value > 0) {
      return '#6ee7b7';
    }
    if (value < 0) {
      return '#fca5a5';
    }
    return '#94a3b8';
  };

  const deltaRows = globalsDelta
    ? [
        {
          label: 'Expected Value',
          value: globalsDelta.expectedValue,
          display: formatSigned(globalsDelta.expectedValue, formatNumber),
        },
        {
          label: 'Worst Case',
          value: globalsDelta.worstCase,
          display: formatSigned(globalsDelta.worstCase, formatNumber),
        },
        {
          label: 'Best Case',
          value: globalsDelta.bestCase,
          display: formatSigned(globalsDelta.bestCase, formatNumber),
        },
        {
          label: 'Total Stake',
          value: globalsDelta.totalStake,
          display: formatSigned(globalsDelta.totalStake, formatNumber),
        },
        {
          label: 'ROI',
          value: globalsDelta.roi,
          display: formatSigned(globalsDelta.roi, formatPercent),
        },
      ]
    : [];

  // D3 Full Visualization Graph (for visualize screen)
  useEffect(() => {
    if (!vizSvgRef.current || !isVisible || isLoading || currentScreen !== 'visualize') return;

    const width = 380;
    const height = 420;

    d3.select(vizSvgRef.current).selectAll('*').remove();

    const svg = d3.select(vizSvgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('style', 'background: transparent; overflow: visible;');

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const nodes = graphView.nodes.map(d => ({ ...d }));
    const links = graphView.links.map(d => ({ ...d }));

    const nodeRadius = 24;
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(28))
      .force('bounds', () => {
        nodes.forEach((d: any) => {
          d.x = Math.max(nodeRadius, Math.min(width - nodeRadius, d.x));
          d.y = Math.max(nodeRadius, Math.min(height - nodeRadius, d.y));
        });
      });

    const vizTooltip = d3.select(vizTooltipRef.current);

    const defs = svg.append('defs');
    defs.append('clipPath')
      .attr('id', 'circleClipOverlay')
      .append('circle')
      .attr('r', 20)
      .attr('cx', 0)
      .attr('cy', 0);

    // Add arrow markers for each relationship type
    const relationshipColors = ['#4a7c6f', '#8b5c5c', '#5c7a9e', '#7a6b8a', '#8a7a5c', '#64748b'];
    relationshipColors.forEach((color, i) => {
      defs.append('marker')
        .attr('id', `arrow-${i}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28) // Position arrow at edge of node (nodeRadius + arrow size)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Create a color to marker ID mapping
    const colorToMarkerId = (color: string) => {
      const index = relationshipColors.indexOf(color);
      return index >= 0 ? `arrow-${index}` : 'arrow-5'; // Default to gray
    };

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d: any) => getRelationshipColor(d.relationship))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', (d: any) => `url(#${colorToMarkerId(getRelationshipColor(d.relationship))})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d: any) => {
        d3.select(event.target as Element)
          .attr('stroke-opacity', 1);

        // Show relationship tooltip
        const sourceLabel = typeof d.source === 'object' ? d.source.label : d.source;
        const targetLabel = typeof d.target === 'object' ? d.target.label : d.target;
        const relationship = d.relationship || 'RELATED';
        const tooltipText = `${relationship}${d.reasoning ? `\n\n${d.reasoning}` : ''}`;

        vizTooltip
          .style('opacity', '1')
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`)
          .style('white-space', 'pre-wrap')
          .html(`<strong style="color: ${getRelationshipColor(d.relationship)}">${relationship}</strong>${d.reasoning ? `<br/><span style="color: #94a3b8; font-size: 10px; margin-top: 4px; display: block;">${d.reasoning}</span>` : ''}`);
      })
      .on('mousemove', (event: MouseEvent) => {
        vizTooltip
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`);
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.target as Element)
          .attr('stroke-opacity', 0.6);
        vizTooltip.style('opacity', '0');
      });

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'grab')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    node.each(function(d: any) {
      const nodeGroup = d3.select(this);
      
      if (d.imageUrl) {
        nodeGroup.append('image')
          .attr('href', d.imageUrl)
          .attr('width', 40)
          .attr('height', 40)
          .attr('x', -20)
          .attr('y', -20)
          .attr('clip-path', 'url(#circleClipOverlay)')
          .attr('preserveAspectRatio', 'xMidYMid slice');
      } else {
        nodeGroup.append('circle')
          .attr('r', 18)
          .attr('fill', '#1e293b')
          .attr('stroke', '#334155')
          .attr('stroke-width', 1);
        
        nodeGroup.append('text')
          .text(d.label.substring(0, 2).toUpperCase())
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', '#64748b')
          .attr('font-size', '9px')
          .attr('font-weight', '500')
          .attr('pointer-events', 'none');
      }
    });

    node
      .on('mouseenter', (event: MouseEvent, d: any) => {
        vizTooltip
          .style('opacity', '1')
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`)
          .style('white-space', 'normal')
          .text(d.label);
      })
      .on('mousemove', (event: MouseEvent) => {
        vizTooltip
          .style('left', `${event.offsetX + 15}px`)
          .style('top', `${event.offsetY - 5}px`);
      })
      .on('mouseleave', () => {
        vizTooltip.style('opacity', '0');
      });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source?.x ?? 0)
        .attr('y1', (d: any) => d.source?.y ?? 0)
        .attr('x2', (d: any) => d.target?.x ?? 0)
        .attr('y2', (d: any) => d.target?.y ?? 0);

      node.attr('transform', (d: any) => {
        const x = d.x ?? 0;
        const y = d.y ?? 0;
        return `translate(${x},${y})`;
      });
    });

    return () => {
      simulation.stop();
    };
  }, [isVisible, isLoading, currentScreen, graphView]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, onClose]);

  // Drag functionality - null means centered, otherwise use position
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Reset position to center when overlay opens
  useEffect(() => {
    if (isVisible) {
      setPosition(null);
    }
  }, [isVisible]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-draggable="true"]')) {
      setIsDragging(true);
      const rect = overlayRef.current?.getBoundingClientRect();
      if (rect) {
        dragOffset.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const addNode = async (label: string) => {
    if (!relationGraph || !currentUrl) {
      return;
    }

    const newNode: RelationGraphNode = {
      id: `node-${Date.now()}`,
      label,
      probability: 0.5,
      weight: 1,
      decision: 'yes',
      relation: 'WEAK_SIGNAL',
      children: [],
    };

    const nextGraph = addChildNode(relationGraph, relationGraph.id, newNode);
    setRelationGraph(nextGraph);
    await saveRelationGraph(currentUrl, nextGraph);
  };

  // Handle Start Pindex - begin analysis
  const handleStart = async () => {
    setHasStarted(true);
    setIsLoading(true);
    // The useEffect will pick up hasStarted change and load the graph
    // After graph loads, we'll auto-accept the root decision and search for dependencies
  };

  // Handle Not Now - close overlay
  const handleNotNow = () => {
    onClose();
  };

  const handleDecision = async (accept: boolean) => {
    if (!currentUrl || !relationGraph || decisionDisabled) {
      return;
    }

    setIsProcessingDecision(true);
    const selectedItem = queuedItem ?? rootFallbackItem;
    if (!selectedItem) {
      setIsProcessingDecision(false);
      return;
    }
    const isRootFallback = Boolean(selectedItem && !queuedItem);

    let nextGraph = relationGraph;
    if (accept && selectedItem && !isRootFallback) {
      nextGraph = addQueueItemToGraph(relationGraph, selectedItem, relationGraph.id);
    }

    try {
      const result = await processDependencyDecisionInBackground({
        eventUrl: currentUrl,
        keep: accept,
        fallbackDecision: selectedItem?.decision ?? rootDecision,
        fallbackWeight: selectedItem?.weight ?? 1,
        risk: riskLevel,
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
        await saveRelationGraph(currentUrl, nextGraph);
      }
    } catch (error) {
      console.error('Failed to process decision', error);
    } finally {
      setIsProcessingDecision(false);
    }
  };

  if (!isVisible) return null;

  // Render Decision Screen
  const renderDecisionScreen = () => (
    <div style={{
      position: 'relative',
      zIndex: 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px 16px',
      overflowY: 'auto',
    }}>
      {/* Risk Slider */}
      <div>
        <div style={{
          fontSize: '9px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          fontWeight: 600,
        }}>Risk</div>
        <div
          onMouseEnter={() => setRiskHover(true)}
          onMouseLeave={() => setRiskHover(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
            color: '#e2e8f0',
            padding: '8px 12px',
            borderRadius: '8px',
            border: riskHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: riskHover ? '0 8px 24px rgba(70, 100, 140, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
            filter: riskHover ? 'brightness(1.2)' : 'brightness(1)',
          }}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={riskLevel}
            onChange={(e) => setRiskLevel(Number(e.target.value))}
            style={{
              flex: 1,
              cursor: 'pointer',
              accentColor: '#5a7a94',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', minWidth: '32px', textAlign: 'right' }}>
            {Math.round(riskLevel)}
          </span>
        </div>
      </div>

      {/* Chain Dependency - Mini Graph */}
      <div>
        <div style={{
          fontSize: '9px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          fontWeight: 600,
        }}>Chain Dependency</div>
        <div style={{
          background: 'transparent',
          borderRadius: '8px',
          border: '1px solid #334155',
          padding: '12px',
        }}>
          <div style={{ position: 'relative' }}>
            <svg ref={svgRef} style={{ overflow: 'visible' }}></svg>
            <div
              ref={tooltipRef}
              style={{
                position: 'absolute',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#94a3b8',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.1s',
                maxWidth: '180px',
                wordWrap: 'break-word',
                zIndex: 10,
              }}
            />
          </div>
          
          {miniGraphData && (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(51, 65, 85, 0.3)',
              }}>
                {miniGraphData.sourceLabel && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                    <div style={{
                      fontSize: '8px',
                      color: '#64748b',
                      textTransform: 'uppercase',
                      minWidth: '45px',
                      paddingTop: '2px',
                    }}>Source</div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: '#e2e8f0',
                      flex: 1,
                      lineHeight: 1.4,
                    }}>{miniGraphData.sourceLabel}</div>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}>
                  <div style={{
                    fontSize: '8px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    minWidth: '45px',
                    paddingTop: '2px',
                  }}>Target</div>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: '#e2e8f0',
                    flex: 1,
                    lineHeight: 1.4,
                  }}>{miniGraphData.targetLabel}</div>
                </div>
              </div>

                {miniGraphData.links[0]?.relationship && (
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                  }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: getRelationshipColor(miniGraphData.links[0].relationship),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {miniGraphData.links[0].relationship}
                  </span>
                </div>
              )}

                {miniGraphData.reasoning && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '10px',
                    color: '#64748b',
                    lineHeight: 1.4,
                  }}>
                    {miniGraphData.reasoning}
                  </div>
                )}
              </>
            )}
            {!miniGraphData && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                fontSize: '10px',
                color: '#64748b',
              lineHeight: 1.4,
              textAlign: 'center',
            }}>
              No queued dependencies yet
            </div>
          )}
        </div>
      </div>

      {/* User Selection Display */}
      {userSelection && showUserSelection && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0',
          borderBottom: '1px solid #1e293b',
        }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Your position</span>
          <span style={{ 
            fontSize: '11px', 
            color: userSelection === 'yes' ? '#6ee7b7' : '#fca5a5',
            fontWeight: 500,
          }}>
            {userSelection === 'yes' ? 'Yes' : 'No'}
          </span>
        </div>
      )}

      {/* Impact Summary */}
      <div>
        <div style={{
          fontSize: '9px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          fontWeight: 600,
        }}>Accept vs Reject</div>
        <motion.div 
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            padding: '12px 14px',
            background: '#1e293b',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: '#f1f5f9',
            letterSpacing: '0.2px',
            display: 'block',
            marginBottom: '8px',
          }}>
            {globalsLoading
              ? 'Calculating impact'
              : globalsError
                ? 'Impact unavailable'
                : 'Decision impact'}
          </span>
          {globalsLoading && (
            <p style={{ 
              margin: 0, 
              fontSize: '11px', 
              color: '#64748b', 
              lineHeight: 1.5,
            }}>
              Comparing accept vs reject outcomes...
            </p>
          )}
          {globalsError && !globalsLoading && (
            <p style={{ 
              margin: 0, 
              fontSize: '11px', 
              color: '#fca5a5', 
              lineHeight: 1.5,
            }}>
              {globalsError}
            </p>
          )}
          {!globalsLoading && !globalsError && globalsDelta && (
            <>
              <div style={{ display: 'grid', gap: '6px' }}>
                {deltaRows.map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#94a3b8',
                    }}
                  >
                    <span>{row.label}</span>
                    <span style={{ color: getDeltaColor(row.value), fontWeight: 600 }}>
                      {row.display}
                    </span>
                  </div>
                ))}
              </div>
              {globalsBaseline && globalsCandidate && (
                <div style={{ 
                  marginTop: '8px', 
                  paddingTop: '8px', 
                  borderTop: '1px solid rgba(51, 65, 85, 0.3)',
                  fontSize: '10px', 
                  color: '#64748b',
                  lineHeight: 1.4,
                }}>
                  Accept EV: {formatNumber(globalsCandidate.expectedValue)} | Reject EV: {formatNumber(globalsBaseline.expectedValue)}
                  <br />
                  Accept ROI: {formatPercent(globalsCandidate.roi)} | Reject ROI: {formatPercent(globalsBaseline.roi)}
                </div>
              )}
            </>
          )}
          {!globalsLoading && !globalsError && !globalsDelta && (
            <p style={{ 
              margin: 0, 
              fontSize: '11px', 
              color: '#64748b', 
              lineHeight: 1.5,
            }}>
              No queued dependency to compare yet.
            </p>
          )}
        </motion.div>
      </div>

      {/* Action Buttons */}
      {hasDecisionTarget && (
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
          <button
            onMouseEnter={() => setAcceptBtnHover(true)}
            onMouseLeave={() => setAcceptBtnHover(false)}
            disabled={decisionDisabled}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '12px',
              cursor: decisionDisabled ? 'not-allowed' : 'pointer',
              border: accepted === true 
                ? '1px solid rgba(110, 231, 183, 0.3)' 
                : acceptBtnHover 
                  ? '1px solid rgba(255, 255, 255, 0.3)' 
                  : '1px solid rgba(255, 255, 255, 0.1)',
              background: accepted === true 
                ? 'linear-gradient(180deg, #2d4a3e 0%, #1e3a2f 100%)' 
                : 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
              color: accepted === true ? '#6ee7b7' : '#e2e8f0',
              transition: 'all 0.2s ease',
              boxShadow: acceptBtnHover && accepted !== true
                ? '0 8px 32px rgba(70, 100, 140, 0.3)' 
                : '0 2px 8px rgba(0, 0, 0, 0.15)',
              filter: acceptBtnHover && accepted !== true ? 'brightness(1.25)' : 'brightness(1)',
              opacity: decisionDisabled ? 0.6 : 1,
            }}
            onClick={() => {
              setAccepted(accepted === true ? null : true);
              handleDecision(true);
            }}
          >
            Accept
          </button>
          <button
            onMouseEnter={() => setRejectBtnHover(true)}
            onMouseLeave={() => setRejectBtnHover(false)}
            disabled={decisionDisabled}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '12px',
              cursor: decisionDisabled ? 'not-allowed' : 'pointer',
              border: accepted === false 
                ? '1px solid rgba(252, 165, 165, 0.3)' 
                : rejectBtnHover 
                  ? '1px solid rgba(255, 255, 255, 0.3)' 
                  : '1px solid rgba(255, 255, 255, 0.1)',
              background: accepted === false 
                ? 'linear-gradient(180deg, #4a2d2d 0%, #3a1e1e 100%)' 
                : 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
              color: accepted === false ? '#fca5a5' : '#e2e8f0',
              transition: 'all 0.2s ease',
              boxShadow: rejectBtnHover && accepted !== false
                ? '0 8px 32px rgba(70, 100, 140, 0.3)' 
                : '0 2px 8px rgba(0, 0, 0, 0.15)',
              filter: rejectBtnHover && accepted !== false ? 'brightness(1.25)' : 'brightness(1)',
              opacity: decisionDisabled ? 0.6 : 1,
            }}
            onClick={() => {
              setAccepted(accepted === false ? null : false);
              handleDecision(false);
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );

  // Render Visualization Screen
  const renderVisualizationScreen = () => (
    <div style={{
      position: 'relative',
      zIndex: 3,
      flex: 1,
      padding: '12px 16px',
      overflowY: 'auto',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{ position: 'relative' }}
      >
        <svg ref={vizSvgRef} style={{ overflow: 'visible' }}></svg>
        <div
          ref={vizTooltipRef}
          style={{
            position: 'absolute',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#94a3b8',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.1s',
            maxWidth: '180px',
            wordWrap: 'break-word',
            zIndex: 10,
          }}
        />
      </motion.div>
      {graphView.nodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569', fontSize: '13px' }}>
          <p style={{ margin: 0 }}>No nodes yet</p>
        </div>
      )}
    </div>
  );

  // Render Add Nodes Screen - state is now at top level
  const renderAddScreen = () => (
    <div style={{
      position: 'relative',
      zIndex: 3,
      flex: 1,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div>
        <div style={{
          fontSize: '9px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
          fontWeight: 600,
        }}>Add Related Market</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newNodeLabel}
            onChange={(e) => setNewNodeLabel(e.target.value)}
            placeholder="Enter market name..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newNodeLabel.trim()) {
                addNode(newNodeLabel.trim());
                setNewNodeLabel('');
              }
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (newNodeLabel.trim()) {
                addNode(newNodeLabel.trim());
                setNewNodeLabel('');
              }
            }}
            onMouseEnter={() => setAddBtnHover(true)}
            onMouseLeave={() => setAddBtnHover(false)}
            style={{
              ...buttonBase,
              padding: '8px 12px',
              border: addBtnHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: addBtnHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
              filter: addBtnHover ? 'brightness(1.25)' : 'brightness(1)',
            }}
          >
            Add
          </button>
        </div>
      </div>
      
      <div>
        <div style={{
          fontSize: '9px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
          fontWeight: 600,
        }}>Current Nodes ({graphView.nodes.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {graphView.nodes.map((node) => (
            <div
              key={node.id}
              style={{
                padding: '8px 12px',
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {node.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        /* Main Panel */
        <motion.div
          key="main-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 99998,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={onClose}
        >
          {/* Panel */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: position ? 'absolute' : 'relative',
              top: position ? position.y : undefined,
              left: position ? position.x : undefined,
              width: '420px',
              height: '600px',
              background: 'linear-gradient(145deg, #0f1520 0%, #0a0e16 50%, #080c12 100%)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.5), 0 25px 80px -12px rgba(0, 0, 0, 0.8), 0 12px 40px -8px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              zIndex: 99999,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'auto',
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Texture overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.025,
              pointerEvents: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              mixBlendMode: 'overlay',
              borderRadius: '20px',
              zIndex: 1,
            }} />
            
            {/* Glossy sheen */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '60%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 30%, transparent 100%)',
              pointerEvents: 'none',
              zIndex: 2,
              borderRadius: '20px 20px 0 0',
            }} />

            {/* Header */}
            <div 
              data-draggable="true"
              style={{
                position: 'relative',
                zIndex: 3,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: displayImage ? 'transparent' : 'linear-gradient(135deg, #475569, #334155)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {displayImage ? (
                    <img src={displayImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b' }}>Pindex</span>
                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    color: '#f1f5f9',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {decisionTitle}
                  </h1>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {currentScreen === 'decision' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentScreen('visualize');
                    }}
                    onMouseEnter={() => setViewNodesHover(true)}
                    onMouseLeave={() => setViewNodesHover(false)}
                    style={{
                      ...buttonBase,
                      padding: '6px 12px',
                      fontSize: '11px',
                      border: viewNodesHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: viewNodesHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                      filter: viewNodesHover ? 'brightness(1.25)' : 'brightness(1)',
                    }}
                  >
                    View Nodes
                  </button>
                )}
                <button 
                  onClick={onClose}
                  onMouseEnter={() => setCloseHover(true)}
                  onMouseLeave={() => setCloseHover(false)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: closeHover ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: '1px solid transparent',
                    color: closeHover ? '#94a3b8' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation (for non-decision/intro screens) */}
            {currentScreen !== 'decision' && currentScreen !== 'intro' && (
              <div style={{
                position: 'relative',
                zIndex: 3,
                padding: '12px 20px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              }}>
                <button
                  onClick={() => setCurrentScreen('decision')}
                  onMouseEnter={() => setBackHover(true)}
                  onMouseLeave={() => setBackHover(false)}
                  style={{
                    ...buttonBase,
                    padding: '6px 12px',
                    fontSize: '11px',
                    border: backHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: backHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                    filter: backHover ? 'brightness(1.25)' : 'brightness(1)',
                  }}
                >
                  Back
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentScreen('add');
                  }}
                  onMouseEnter={() => setAddHover(true)}
                  onMouseLeave={() => setAddHover(false)}
                  style={{
                    ...buttonBase,
                    padding: '6px 12px',
                    fontSize: '11px',
                    background: currentScreen === 'add' ? 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)' : addHover ? 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)' : 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
                    color: '#e2e8f0',
                    border: currentScreen === 'add' || addHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: addHover ? '0 8px 32px rgba(70, 100, 140, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                    filter: addHover && currentScreen !== 'add' ? 'brightness(1.25)' : 'brightness(1)',
                  }}
                >
                  Add
                </button>
              </div>
            )}

            {/* Content */}
            {showLoader ? (
              <div style={{
                position: 'relative',
                zIndex: 3,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}>
                <VideoLoader size={160} />
                <span style={{ fontSize: '13px', color: '#94a3b8', letterSpacing: '0.4px' }}>
                  {isLoading ? 'searching dependencies...' : 'calculating...'}
                </span>
              </div>
            ) : currentScreen === 'intro' ? (
              /* Intro Screen */
              <div style={{
                position: 'relative',
                zIndex: 3,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 24px',
                gap: '24px',
              }}>
                {/* Market image */}
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}>
                  {displayImage ? (
                    <img 
                      src={displayImage} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 600,
                      color: '#64748b',
                    }}>
                      {eventTitle.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Event title */}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#f1f5f9',
                    margin: '0 0 8px 0',
                    lineHeight: 1.3,
                  }}>
                    {eventTitle}
                  </h2>
                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    margin: 0,
                  }}>
                    Analyze market dependencies and correlations
                  </p>
                </div>

                {/* Buttons */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  width: '100%',
                  maxWidth: '260px',
                }}>
                  <button
                    onClick={handleStart}
                    onMouseEnter={() => setStartHover(true)}
                    onMouseLeave={() => setStartHover(false)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: startHover ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'linear-gradient(180deg, #4a5f73 0%, #3d4f63 100%)',
                      color: '#e2e8f0',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: startHover ? '0 8px 24px rgba(70, 100, 140, 0.35)' : '0 4px 16px rgba(70, 100, 140, 0.25)',
                      transition: 'all 0.15s ease',
                      filter: startHover ? 'brightness(1.15)' : 'brightness(1)',
                    }}
                  >
                    Start Pindex
                  </button>
                  <button
                    onClick={handleNotNow}
                    onMouseEnter={() => setNotNowHover(true)}
                    onMouseLeave={() => setNotNowHover(false)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: notNowHover ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'linear-gradient(180deg, #3d4f63 0%, #2a3a4a 100%)',
                      color: notNowHover ? '#e2e8f0' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      boxShadow: notNowHover ? '0 6px 20px rgba(70, 100, 140, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.15s ease',
                      filter: notNowHover ? 'brightness(1.1)' : 'brightness(1)',
                    }}
                  >
                    Not now
                  </button>
                </div>
              </div>
            ) : (
              <>
                {currentScreen === 'decision' && renderDecisionScreen()}
                {currentScreen === 'visualize' && renderVisualizationScreen()}
                {currentScreen === 'add' && renderAddScreen()}
              </>
            )}

            {/* Footer */}
            <div style={{
              position: 'relative',
              zIndex: 3,
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              background: 'rgba(0, 0, 0, 0.2)',
            }}>
              <span style={{ fontSize: '9px', color: '#334155', fontWeight: 500 }}>Drag header to move | ESC to close</span>
              <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#475569' }}>pindex</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
