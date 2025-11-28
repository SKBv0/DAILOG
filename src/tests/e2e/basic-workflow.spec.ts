/**
 * E2E tests for basic user workflows
 */
import { test, expect } from '@playwright/test';

test.describe('Basic Dialog Editor Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if main components are visible
    await expect(page.locator('[data-testid="app-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible();
    
    // Check if React Flow canvas is present
    await expect(page.locator('.react-flow')).toBeVisible();
    
    // Check page title
    await expect(page).toHaveTitle(/Dialog Flow Editor/);
  });

  test('should create a new NPC dialog node', async ({ page }) => {
    // Open node selector
    const addButton = page.locator('[data-testid="add-node-button"]');
    await addButton.click();
    
    // Select NPC Dialog node type
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Verify node appears on canvas
    await expect(page.locator('[data-node-type="npcDialog"]')).toBeVisible();
    
    // Check if node has default content
    const nodeElement = page.locator('[data-node-type="npcDialog"]').first();
    await expect(nodeElement).toContainText('NPC Dialog');
  });

  test('should edit node content in right panel', async ({ page }) => {
    // First create a node
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Select the node
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    
    // Check if right panel shows node editor
    await expect(page.locator('[data-testid="node-editor"]')).toBeVisible();
    
    // Edit node text
    const textInput = page.locator('[data-testid="node-text-input"]');
    await textInput.fill('Welcome to our village, traveler!');
    
    // Edit speaker name
    const speakerInput = page.locator('[data-testid="node-speaker-input"]');
    await speakerInput.fill('Village Guard');
    
    // Verify changes appear in node
    await expect(node).toContainText('Welcome to our village');
    await expect(node).toContainText('Village Guard');
  });

  test('should connect two nodes with an edge', async ({ page }) => {
    // Create two nodes
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-playerResponse"]').click();
    
    // Wait for nodes to be positioned
    await page.waitForTimeout(500);
    
    // Get node handles
    const sourceNode = page.locator('[data-node-type="npcDialog"]').first();
    const targetNode = page.locator('[data-node-type="playerResponse"]').first();
    
    // Connect nodes by dragging from source handle to target handle
    const sourceHandle = sourceNode.locator('.react-flow__handle-right');
    const targetHandle = targetNode.locator('.react-flow__handle-left');
    
    await sourceHandle.hover();
    await page.mouse.down();
    await targetHandle.hover();
    await page.mouse.up();
    
    // Verify edge was created
    await expect(page.locator('.react-flow__edge')).toBeVisible();
  });

  test('should save and load project', async ({ page }) => {
    // Create a simple dialog flow
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Edit the node
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    
    const textInput = page.locator('[data-testid="node-text-input"]');
    await textInput.fill('Test dialog content');
    
    // Save project
    await page.keyboard.press('Control+S');
    
    // Wait for save confirmation
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // Reload page to test persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify content persisted
    await expect(page.locator('[data-node-type="npcDialog"]')).toContainText('Test dialog content');
  });

  test('should export project as JSON', async ({ page }) => {
    // Create a node
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Edit node content
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    await page.locator('[data-testid="node-text-input"]').fill('Export test content');
    
    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="export-button"]').click();
    await page.locator('[data-testid="export-json"]').click();
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    
    // Save and verify file content
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should import project from JSON', async ({ page }) => {
    // Create a test project file
    const testProject = {
      schemaVersion: '2.0.0',
      nodes: [
        {
          id: 'npcDialog_test',
          type: 'npcDialog',
          position: { x: 100, y: 100 },
          data: {
            text: 'Imported dialog text',
            speaker: 'Imported NPC',
            conditions: [],
            effects: [],
            tags: [],
          },
        },
      ],
      edges: [],
      tags: [],
    };
    
    // Create a file and upload it
    const fileContent = JSON.stringify(testProject, null, 2);
    const fileInput = page.locator('[data-testid="import-file-input"]');
    
    // Create a temporary file
    await fileInput.setInputFiles({
      name: 'test-project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent, 'utf-8'),
    });
    
    // Wait for import to complete
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    
    // Verify imported content
    await expect(page.locator('[data-node-type="npcDialog"]')).toContainText('Imported dialog text');
    await expect(page.locator('[data-node-type="npcDialog"]')).toContainText('Imported NPC');
  });

  test('should handle undo/redo operations', async ({ page }) => {
    // Initial state - no nodes
    await expect(page.locator('[data-node-type]')).toHaveCount(0);
    
    // Create a node
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Verify node exists
    await expect(page.locator('[data-node-type="npcDialog"]')).toHaveCount(1);
    
    // Undo
    await page.keyboard.press('Control+Z');
    
    // Verify node is removed
    await expect(page.locator('[data-node-type="npcDialog"]')).toHaveCount(0);
    
    // Redo
    await page.keyboard.press('Control+Y');
    
    // Verify node is back
    await expect(page.locator('[data-node-type="npcDialog"]')).toHaveCount(1);
  });

  test('should validate dialog flow', async ({ page }) => {
    // Create nodes with validation issues
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Leave node with empty text to create validation error
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    await page.locator('[data-testid="node-text-input"]').fill('');
    
    // Run validation
    await page.locator('[data-testid="validate-button"]').click();
    
    // Check validation results
    await expect(page.locator('[data-testid="validation-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-errors"]')).toContainText('Empty text');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test various keyboard shortcuts
    
    // New project: Ctrl+N
    await page.keyboard.press('Control+N');
    await expect(page.locator('[data-testid="new-project-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Create node and test delete
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Select node and delete with Delete key
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    await page.keyboard.press('Delete');
    
    // Verify node is deleted
    await expect(page.locator('[data-node-type="npcDialog"]')).toHaveCount(0);
    
    // Undo deletion
    await page.keyboard.press('Control+Z');
    await expect(page.locator('[data-node-type="npcDialog"]')).toHaveCount(1);
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if mobile-specific elements are visible
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    // Check if panels collapse appropriately
    const leftPanel = page.locator('[data-testid="left-panel"]');
    const rightPanel = page.locator('[data-testid="right-panel"]');
    
    // Panels might be hidden or collapsed on mobile
    await expect(leftPanel).toHaveAttribute('data-collapsed', 'true');
    await expect(rightPanel).toHaveAttribute('data-collapsed', 'true');
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Panels should be partially visible
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // All panels should be fully visible
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();
    await expect(leftPanel).not.toHaveAttribute('data-collapsed', 'true');
    await expect(rightPanel).not.toHaveAttribute('data-collapsed', 'true');
  });
});

test.describe('Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle tags and tagging system', async ({ page }) => {
    // Create a node
    await page.locator('[data-testid="add-node-button"]').click();
    await page.locator('[data-testid="node-type-npcDialog"]').click();
    
    // Select node and open tag editor
    const node = page.locator('[data-node-type="npcDialog"]').first();
    await node.click();
    
    // Add tags
    await page.locator('[data-testid="add-tag-button"]').click();
    await page.locator('[data-testid="tag-input"]').fill('important');
    await page.keyboard.press('Enter');
    
    await page.locator('[data-testid="add-tag-button"]').click();
    await page.locator('[data-testid="tag-input"]').fill('intro');
    await page.keyboard.press('Enter');
    
    // Verify tags appear in node
    await expect(node.locator('[data-testid="node-tag"]')).toHaveCount(2);
    await expect(node).toContainText('important');
    await expect(node).toContainText('intro');
  });

  test('should handle AI-powered features', async ({ page }) => {
    // Skip if AI features are not available in test environment
    const aiButton = page.locator('[data-testid="ai-assist-button"]');
    if (await aiButton.isVisible()) {
      // Create a node
      await page.locator('[data-testid="add-node-button"]').click();
      await page.locator('[data-testid="node-type-npcDialog"]').click();
      
      // Select node
      const node = page.locator('[data-node-type="npcDialog"]').first();
      await node.click();
      
      // Try AI suggestion
      await aiButton.click();
      
      // Wait for AI response (with timeout)
      await expect(page.locator('[data-testid="ai-suggestion"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle auto-layout functionality', async ({ page }) => {
    // Create multiple nodes
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="add-node-button"]').click();
      await page.locator('[data-testid="node-type-npcDialog"]').click();
    }
    
    // Connect some nodes randomly to create a messy layout
    const nodes = page.locator('[data-node-type="npcDialog"]');
    for (let i = 0; i < 3; i++) {
      const sourceNode = nodes.nth(i);
      const targetNode = nodes.nth(i + 1);
      
      const sourceHandle = sourceNode.locator('.react-flow__handle-right');
      const targetHandle = targetNode.locator('.react-flow__handle-left');
      
      await sourceHandle.hover();
      await page.mouse.down();
      await targetHandle.hover();
      await page.mouse.up();
      
      await page.waitForTimeout(200);
    }
    
    // Apply auto-layout
    await page.locator('[data-testid="auto-layout-button"]').click();
    
    // Wait for layout animation to complete
    await page.waitForTimeout(1000);
    
    // Verify nodes are properly arranged
    const nodePositions = await nodes.evaluateAll((elements) => 
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
      })
    );
    
    // Check that nodes are not overlapping (basic layout check)
    for (let i = 0; i < nodePositions.length; i++) {
      for (let j = i + 1; j < nodePositions.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodePositions[i].x - nodePositions[j].x, 2) +
          Math.pow(nodePositions[i].y - nodePositions[j].y, 2)
        );
        expect(distance).toBeGreaterThan(50); // Minimum distance between nodes
      }
    }
  });
});