'use client';

import React, { useState } from 'react';
import { 
  useAgentManager, 
  useOrderOptimization, 
  useCustomerFeedbackAnalysis, 
  useInventoryPrediction,
  useRevenueAnalysis,
  useNLPProcessing,
  useAgentStatus
} from '@/hooks/useAgentManager';

const AgentCoordinationDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const agentManager = useAgentManager();
  const orderOptimization = useOrderOptimization();
  const feedbackAnalysis = useCustomerFeedbackAnalysis();
  const inventoryPrediction = useInventoryPrediction();
  const revenueAnalysis = useRevenueAnalysis();
  const nlpProcessing = useNLPProcessing();
  const agentStatus = useAgentStatus();

  const sampleOrders = [
    {
      id: 'order_1',
      tableId: 'table_3',
      items: [
        { name: 'Paneer Tikka', quantity: 2, complexity: 3, prepTime: 15, station: 'grill', ingredients: ['paneer', 'onions', 'spices'] },
        { name: 'Dal Tadka', quantity: 1, complexity: 2, prepTime: 10, station: 'curry', ingredients: ['dal', 'onions', 'spices'] }
      ],
      priority: 'high',
      orderTime: new Date(Date.now() - 300000).toISOString(),
      specialRequests: ['less spicy']
    },
    {
      id: 'order_2',
      tableId: 'table_7',
      items: [
        { name: 'Chicken Biryani', quantity: 1, complexity: 4, prepTime: 25, station: 'curry', ingredients: ['chicken', 'rice', 'spices'] },
        { name: 'Lassi', quantity: 2, complexity: 1, prepTime: 3, station: 'beverage', ingredients: ['yogurt', 'sugar'] }
      ],
      priority: 'normal',
      orderTime: new Date(Date.now() - 600000).toISOString()
    },
    {
      id: 'order_3',
      tableId: 'table_12',
      items: [
        { name: 'Naan', quantity: 4, complexity: 2, prepTime: 8, station: 'tandoor', ingredients: ['flour', 'water'] },
        { name: 'Butter Chicken', quantity: 2, complexity: 3, prepTime: 18, station: 'curry', ingredients: ['chicken', 'butter', 'tomatoes', 'spices'] }
      ],
      priority: 'critical',
      orderTime: new Date(Date.now() - 900000).toISOString()
    }
  ];

  const sampleFeedback = [
    "The food was excellent but the service was very slow. We waited 45 minutes!",
    "बहुत अच्छा खाना था लेकिन थोडा महंगा है। Staff भी बहुत friendly है।",
    "Terrible experience! The paneer was cold and the waiter was rude. Never coming back!",
    "Amazing food quality! The dal was perfect and service was quick. Will recommend to friends."
  ];

  const runOrderOptimization = async () => {
    setIsLoading(true);
    try {
      const result = await orderOptimization.optimizeOrders(sampleOrders, {
        peakHours: true,
        availableStaff: 8
      });
      setResults(result);
    } catch (error) {
      console.error('Order optimization failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runFeedbackAnalysis = async () => {
    setIsLoading(true);
    try {
      const analysisResults = [];
      
      for (const feedback of sampleFeedback) {
        const result = await feedbackAnalysis.analyzeFeedback(feedback, {
          tableId: `table_${Math.floor(Math.random() * 20) + 1}`,
          staffMember: `staff_${Math.floor(Math.random() * 5) + 1}`,
          timestamp: new Date().toISOString()
        });
        analysisResults.push({ feedback, ...result });
      }
      
      setResults({ analyses: analysisResults });
    } catch (error) {
      console.error('Feedback analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runInventoryPrediction = async () => {
    setIsLoading(true);
    try {
      const result = await inventoryPrediction.predictInventory({
        timeRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        promotionalItems: ['paneer'],
        upcomingEvents: ['weekend_special']
      });
      setResults(result);
    } catch (error) {
      console.error('Inventory prediction failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runRevenueAnalysis = async () => {
    setIsLoading(true);
    try {
      const result = await revenueAnalysis.analyzeRevenue({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      });
      setResults(result);
    } catch (error) {
      console.error('Revenue analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runNLPDemo = async () => {
    setIsLoading(true);
    try {
      const testTexts = [
        "Table 5 needs the paneer tikka ready in 10 minutes",
        "यह खाना बहुत स्वादिष्ट है लेकिन service slow है",
        "Emergency! Customer is having allergic reaction at table 12!"
      ];

      const nlpResults = [];
      for (const text of testTexts) {
        const result = await nlpProcessing.processText(text);
        nlpResults.push({ text, ...result });
      }

      setResults({ nlpResults });
    } catch (error) {
      console.error('NLP processing failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runCoordinatedDemo = async () => {
    setIsLoading(true);
    try {
      // Simulate a complex restaurant scenario with multiple agents working together
      const coordinatedResults = await Promise.allSettled([
        orderOptimization.optimizeOrders(sampleOrders.slice(0, 2)),
        inventoryPrediction.checkInventoryAlerts(),
        feedbackAnalysis.analyzeFeedback(sampleFeedback[0])
      ]);

      setResults({
        coordination: {
          orderOptimization: coordinatedResults[0].status === 'fulfilled' ? coordinatedResults[0].value : null,
          inventoryAlerts: coordinatedResults[1].status === 'fulfilled' ? coordinatedResults[1].value : null,
          feedbackAnalysis: coordinatedResults[2].status === 'fulfilled' ? coordinatedResults[2].value : null
        }
      });
    } catch (error) {
      console.error('Coordinated demo failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'System Overview' },
    { id: 'orders', label: 'Order Optimization' },
    { id: 'feedback', label: 'Feedback Analysis' },
    { id: 'inventory', label: 'Inventory Prediction' },
    { id: 'revenue', label: 'Revenue Analysis' },
    { id: 'nlp', label: 'NLP Processing' },
    { id: 'coordinated', label: 'Coordinated Demo' }
  ];

  const renderSystemOverview = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Agent Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(agentStatus.agentStatuses).map(([agentId, status]: [string, any]) => (
            <div key={agentId} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{agentId}</h4>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  status.status === 'idle' ? 'bg-green-100 text-green-800' :
                  status.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                  status.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {status.status}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Queue: {agentStatus.systemStatus?.queues?.[agentId] || 0}</p>
                <p>Last Heartbeat: {status.lastHeartbeat ? new Date(status.lastHeartbeat).toLocaleTimeString() : 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Metrics</h3>
        {agentStatus.systemStatus?.tasks && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{agentStatus.systemStatus.tasks.total}</div>
              <div className="text-sm text-gray-600">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{agentStatus.systemStatus.tasks.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{agentStatus.systemStatus.tasks.running}</div>
              <div className="text-sm text-gray-600">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{agentStatus.systemStatus.tasks.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{agentStatus.systemStatus.tasks.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
        <div className="flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${agentManager.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{agentManager.isConnected ? 'Connected' : 'Disconnected'}</span>
          {agentManager.lastError && (
            <span className="text-red-600 text-sm">Error: {agentManager.lastError}</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Results</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-sm overflow-auto max-h-96">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Coordination System Demo</h1>
        <p className="text-gray-600">
          Showcase of the MessageBus and AgentManager with coordinated AI agents for restaurant management.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && renderSystemOverview()}
          
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Order Optimization Demo</h3>
                <p className="text-gray-600 mb-4">
                  Optimize kitchen workflow by analyzing orders, creating batches, and identifying bottlenecks.
                </p>
                <button
                  onClick={runOrderOptimization}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Run Order Optimization'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Customer Feedback Analysis</h3>
                <p className="text-gray-600 mb-4">
                  Analyze customer feedback using NLP and sentiment analysis across multiple languages.
                </p>
                <button
                  onClick={runFeedbackAnalysis}
                  disabled={isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Feedback Samples'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Inventory Prediction</h3>
                <p className="text-gray-600 mb-4">
                  Predict inventory needs, identify potential stockouts, and optimize restock schedules.
                </p>
                <button
                  onClick={runInventoryPrediction}
                  disabled={isLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isLoading ? 'Predicting...' : 'Run Inventory Prediction'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Revenue Analysis</h3>
                <p className="text-gray-600 mb-4">
                  Analyze revenue patterns, optimize pricing, and identify growth opportunities.
                </p>
                <button
                  onClick={runRevenueAnalysis}
                  disabled={isLoading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isLoading ? 'Analyzing...' : 'Run Revenue Analysis'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}

          {activeTab === 'nlp' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">NLP Processing Demo</h3>
                <p className="text-gray-600 mb-4">
                  Process natural language text with intent classification, entity extraction, and sentiment analysis.
                </p>
                <button
                  onClick={runNLPDemo}
                  disabled={isLoading}
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Run NLP Demo'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}

          {activeTab === 'coordinated' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Coordinated Multi-Agent Demo</h3>
                <p className="text-gray-600 mb-4">
                  Demonstrate multiple agents working together simultaneously on different aspects of restaurant management.
                </p>
                <button
                  onClick={runCoordinatedDemo}
                  disabled={isLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Coordinating...' : 'Run Coordinated Demo'}
                </button>
              </div>
              {renderResults()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCoordinationDemo;