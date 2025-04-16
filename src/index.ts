import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "http://5.254.187.244:8080/api/v1";

// Authentication state
let authToken: string | null = null;

// Create server instance
const server = new McpServer({
  name: "ssp-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function for making API requests
async function makeAPIRequest<T>(endpoint: string, method: string = "GET", body?: any): Promise<T | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Add authorization header if token exists
  if (authToken) {
    headers["authorization"] = `Bearer ${authToken}`;
  }

  console.error(`[API Request] ${method} ${endpoint}`);
  console.error('[Headers]', JSON.stringify(headers, null, 2));
  if (body) {
    console.error('[Request Body]', JSON.stringify(body, null, 2));
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.error(`[Response Status] ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('[Auth] Token expired or invalid, clearing token');
        authToken = null;
      }
      const errorText = await response.text();
      console.error('[Error Response]', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.error('[Response Data]', JSON.stringify(data, null, 2));
    return data as T;
  } catch (error) {
    console.error('[API Error] endpoint: ', endpoint);
    console.error('[API Error] headers: ', headers);
    console.error('[API Error]', error);
    return null;
  }
}

// Login tool to get JWT token
server.tool(
  "login",
  "Authenticate with username and password to get JWT token",
  {
    email: z.string().describe("Username for authentication"),
    password: z.string().describe("Password for authentication"),
  },
  async ({ email, password }) => {
    console.error('[Auth] Attempting login for user:', email);

    try {
      const response = await fetch(`${API_BASE}/users/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      console.error(`[Auth Response] Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Auth Error]', errorData);
        return {
          content: [
            {
              type: "text",
              text: "Authentication failed. Please check your credentials.",
            },
          ],
        };
      }

      const data = await response.json();
      authToken = data.data.access_token;
      console.error('[Auth] Successfully authenticated and received token');
      // console.error('token: ', data)

      return {
        content: [
          {
            type: "text",
            text: "Successfully authenticated!",
          },
        ],
      };
    } catch (error) {
      console.error('[Auth Error]', error);
      return {
        content: [
          {
            type: "text",
            text: "Error during authentication. Please try again.",
          },
        ],
      };
    }
  }
);

server.tool(
  "get-rack-list",
  "Get a list of racks with optional pagination and search",
  {
    page: z.number().optional().describe("Page number"),
    page_size: z.number().optional().describe("Number of results per page"),
    search: z.string().optional().describe("Search term"),
  },
  async ({ page, page_size, search }) => {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append("page", page.toString());
    if (page_size) queryParams.append("page_size", page_size.toString());
    if (search) queryParams.append("search", search);

    const endpoint = `/additionalservices/racklist${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve rack list",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get-rack-detail",
  "Get detailed information about a specific rack",
  {
    id: z.string().describe("ID of the rack"),
  },
  async ({ id }) => {
    const endpoint = `/additionalservices/rackdetail/${id}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve details for rack ${id}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get-power-consumption",
  "Get power consumption data for a rack",
  {
    rack_pk: z.string().describe("ID of the rack"),
    from: z.string().describe("Start date-time in ISO format"),
    to: z.string().describe("End date-time in ISO format"),
  },
  async ({ rack_pk, from, to }) => {
    const endpoint = `/additionalservices/${rack_pk}/chartpowerconsumption?from=${from}&to=${to}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve power consumption data for rack ${rack_pk}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get-power-load",
  "Get power load data for a rack",
  {
    rack_pk: z.string().describe("ID of the rack"),
    from: z.string().describe("Start date-time in ISO format"),
    to: z.string().describe("End date-time in ISO format"),
  },
  async ({ rack_pk, from, to }) => {
    const endpoint = `/additionalservices/${rack_pk}/chartpowerload?from=${from}&to=${to}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve power load data for rack ${rack_pk}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get-project-list",
  "Get a list of projects with optional search and ordering",
  {
    search: z.string().optional().describe("Search by name or project number"),
    ordering: z.string().optional().describe("Order by specified fields"),
    page: z.number().optional().describe("Page number"),
    page_size: z.number().optional().describe("Number of results per page"),
  },
  async ({ search, ordering, page, page_size }) => {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);
    if (ordering) queryParams.append("ordering", ordering);
    if (page) queryParams.append("page", page.toString());
    if (page_size) queryParams.append("page_size", page_size.toString());

    const endpoint = `/additionalservices/projectlist${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve project list",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get-ticket-list",
  "Get a list of tickets with optional filtering and pagination",
  {
    page: z.number().optional().describe("Page number"),
    page_size: z.number().optional().describe("Number of results per page"),
    search: z.string().optional().describe("Search term"),
    status: z.string().optional().describe("Filter by ticket status"),
    priority: z.string().optional().describe("Filter by ticket priority"),
    ordering: z.string().optional().describe("Order by specified fields"),
  },
  async ({ page, page_size, search, status, priority, ordering }) => {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append("page", page.toString());
    if (page_size) queryParams.append("page_size", page_size.toString());
    if (search) queryParams.append("search", search);
    if (status) queryParams.append("status", status);
    if (priority) queryParams.append("priority", priority);
    if (ordering) queryParams.append("ordering", ordering);

    const endpoint = `/ticket/${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const data = await makeAPIRequest(endpoint);

    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve ticket list",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SSP MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});