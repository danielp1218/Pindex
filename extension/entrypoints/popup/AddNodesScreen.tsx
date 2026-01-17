import { GraphData, Node } from '@/types/graph';

interface AddNodesScreenProps {
  graphData: GraphData;
  onGraphUpdate: (newGraphData: GraphData) => void;
}

function AddNodesScreen({ graphData, onGraphUpdate }: AddNodesScreenProps) {
  const generateRandomLabel = () => {
    const adjectives = ['Quick', 'Lazy', 'Happy', 'Sad', 'Brave', 'Smart', 'Wild', 'Calm', 'Bold', 'Swift'];
    const nouns = ['Fox', 'Dog', 'Cat', 'Bear', 'Wolf', 'Eagle', 'Tiger', 'Lion', 'Hawk', 'Owl'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  };

  const addRandomNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: generateRandomLabel(),
    };

    // Pick a random existing node to link to
    const randomExistingNode = graphData.nodes[Math.floor(Math.random() * graphData.nodes.length)];

    const newGraphData: GraphData = {
      nodes: [...graphData.nodes, newNode],
      links: [...graphData.links, { source: randomExistingNode.id, target: newNode.id }],
    };

    onGraphUpdate(newGraphData);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p>Total nodes: {graphData.nodes.length}</p>
        <p>Total links: {graphData.links.length}</p>
      </div>
      
      <button 
        onClick={addRandomNode}
        style={{
          padding: '15px 30px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
        }}
      >
        Add Random Node
      </button>

      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        <h3>Nodes:</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {graphData.nodes.map((node) => (
            <li key={node.id} style={{ padding: '5px 0' }}>
              {node.label} <span style={{ color: '#666', fontSize: '12px' }}>({node.id})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AddNodesScreen;
