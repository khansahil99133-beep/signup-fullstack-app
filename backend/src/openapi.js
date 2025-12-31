export const openapi = {
  openapi: "3.0.3",
  info: { title: "Sign UP Jeetwin API", version: "2.3.0" },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "admin_session" },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      BlogPost: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          coverImageUrl: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } },
          published: { type: "boolean" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          publishedAt: { type: ["string", "null"] },
          contentMarkdown: { type: "string" },
        },
      },

      BlogUpsert: {
        type: "object",
        required: ["title", "contentMarkdown"],
        properties: {
          title: { type: "string", example: "How to join Sign UP Jeetwin" },
          slug: { type: "string", example: "how-to-join-sign-up-jeetwin" },
          excerpt: { type: "string", example: "Quick guide for new users." },
          contentMarkdown: { type: "string", example: "# Welcome\n\nThis is a guide..." },
          coverImageUrl: { type: ["string", "null"], example: "/uploads/1700000000-acde12ab.png" },
          tags: { type: "array", items: { type: "string" }, example: ["guide", "update"] },
          published: { type: "boolean", example: false },
        },
      },

      BlogListResponse: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/BlogPost" } },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          pages: { type: "integer" },
        },
      },

      BlogTagsResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { tag: { type: "string" }, count: { type: "integer" } },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": { get: { summary: "Health check", responses: { 200: { description: "OK" } } } },

    "/signup": {
      post: {
        summary: "Create a new signup user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password", "mobileNumber"],
                properties: {
                  username: {
                    type: "string",
                    description: "3-24 chars: letters/numbers/underscore",
                  },
                  email: { type: "string", nullable: true },
                  mobileNumber: { type: "string", description: "E.164: +919876543210" },
                  whatsappNumber: {
                    type: "string",
                    nullable: true,
                    description: "E.164: +919876543210",
                  },
                  telegramUsername: { type: "string", nullable: true, description: "@username" },
                  password: { type: "string", description: "Min 8, include 1 letter and 1 number" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Created" },
          400: { description: "Validation error" },
          409: { description: "Username already exists" },
        },
      },
    },

    "/auth/login": {
      post: {
        summary: "Admin login (sets HttpOnly cookie)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: { username: { type: "string" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in" },
          401: { description: "Invalid credentials" },
        },
      },
    },

    "/auth/me": {
      get: {
        summary: "Current admin session",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: { description: "Authenticated" },
          401: { description: "Not authenticated" },
        },
      },
    },

    "/auth/logout": {
      post: {
        summary: "Logout (clears cookie)",
        responses: { 200: { description: "Logged out" } },
      },
    },

    "/admin/users": {
      get: {
        summary: "List signup users (admin) with server-side filtering/pagination",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["pending", "approved", "rejected"] },
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["newest", "oldest"] },
          },
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
          {
            name: "pageSize",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        responses: { 200: { description: "OK" }, 401: { description: "Not authenticated" } },
      },
    },

    "/admin/users/export.csv": {
      get: {
        summary: "Export filtered users as CSV (admin)",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["pending", "approved", "rejected"] },
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["newest", "oldest"] },
          },
        ],
        responses: { 200: { description: "CSV" }, 401: { description: "Not authenticated" } },
      },
    },

    "/admin/users/{id}": {
      patch: {
        summary: "Update user status (admin) + audit log + per-user status history",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["pending", "approved", "rejected"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          400: { description: "Validation error" },
          404: { description: "Not found" },
        },
      },
    },

    "/admin/users/{id}/reset-token": {
      post: {
        summary: "Create a one-time password reset token (admin)",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
    },

    "/reset-password": {
      "/blog": {
        get: {
          summary: "List published blog posts (public)",
          parameters: [
            { name: "q", in: "query", required: false, schema: { type: "string" } },
            { name: "tag", in: "query", required: false, schema: { type: "string" } },
            {
              name: "sort",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["newest", "oldest"] },
            },
            { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            {
              name: "pageSize",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50 },
            },
          ],
          responses: {
            200: {
              description: "Blog list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BlogListResponse" },
                  examples: {
                    ok: {
                      value: {
                        items: [
                          {
                            id: "p_123",
                            slug: "how-to-join-sign-up-jeetwin",
                            title: "How to join Sign UP Jeetwin",
                            excerpt: "Quick guide for new users.",
                            coverImageUrl: null,
                            tags: ["guide"],
                            published: true,
                            createdAt: "2025-01-01T10:00:00.000Z",
                            updatedAt: "2025-01-01T10:10:00.000Z",
                            publishedAt: "2025-01-01T10:10:00.000Z",
                          },
                        ],
                        total: 1,
                        page: 1,
                        pageSize: 10,
                        pages: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/blog/{slug}": {
        get: {
          summary: "Get one published blog post (public)",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Blog post + related",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      post: { $ref: "#/components/schemas/BlogPost" },
                      related: { type: "array", items: { $ref: "#/components/schemas/BlogPost" } },
                    },
                  },
                },
              },
            },
            404: { description: "Not found" },
          },
        },
      },
      "/admin/blog": {
        get: {
          summary: "List blog posts (admin)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            { name: "q", in: "query", required: false, schema: { type: "string" } },
            { name: "tag", in: "query", required: false, schema: { type: "string" } },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["all", "published", "draft"] },
            },
            {
              name: "sort",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["newest", "oldest"] },
            },
            { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            {
              name: "pageSize",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50 },
            },
          ],
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/BlogListResponse" } },
              },
            },
            401: { description: "Not authenticated" },
          },
        },
        post: {
          summary: "Create a blog post (admin)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BlogUpsert" },
                examples: {
                  draft: {
                    summary: "Create draft",
                    value: {
                      title: "How to join Sign UP Jeetwin",
                      slug: "how-to-join-sign-up-jeetwin",
                      excerpt: "Quick guide for new users.",
                      tags: ["guide", "update"],
                      published: false,
                      coverImageUrl: null,
                      contentMarkdown: "# Welcome\n\nThis is a guide...",
                    },
                  },
                  publish: {
                    summary: "Create and publish",
                    value: {
                      title: "Weekly update #1",
                      tags: ["update"],
                      published: true,
                      contentMarkdown: "## Updates\n\n- Item 1\n- Item 2",
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { post: { $ref: "#/components/schemas/BlogPost" } },
                  },
                },
              },
            },
            400: { description: "Validation error" },
            401: { description: "Not authenticated" },
          },
        },
      },
      "/admin/blog/{id}": {
        patch: {
          summary: "Update a blog post (admin)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BlogUpsert" },
                examples: {
                  publishExisting: {
                    summary: "Publish an existing draft",
                    value: {
                      title: "How to join Sign UP Jeetwin",
                      slug: "how-to-join-sign-up-jeetwin",
                      tags: ["guide"],
                      published: true,
                      contentMarkdown: "# Welcome\n\nUpdated content...",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Updated" },
            401: { description: "Not authenticated" },
            404: { description: "Not found" },
          },
        },
        delete: {
          summary: "Delete a blog post (admin)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Deleted" },
            401: { description: "Not authenticated" },
            404: { description: "Not found" },
          },
        },
      },
      "/admin/uploads/image": {
        post: {
          summary: "Upload an image (admin)",
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Uploaded",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { url: { type: "string" } } },
                  examples: { ok: { value: { url: "/uploads/1700000000-acde12ab.png" } } },
                },
              },
            },
            401: { description: "Not authenticated" },
          },
        },
      },

      post: {
        summary: "Reset password using token (public)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: { token: { type: "string" }, newPassword: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          400: { description: "Validation error" },
          410: { description: "Expired/invalid token" },
        },
      },
    },

    "/admin/audit/export.csv": {
      get: {
        summary: "Export audit log as CSV (admin)",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { 200: { description: "CSV" }, 401: { description: "Not authenticated" } },
      },
    },

    "/admin/audit": {
      get: {
        summary: "Audit log (admin) with pagination",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
          {
            name: "pageSize",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 200 },
          },
        ],
        responses: { 200: { description: "OK" }, 401: { description: "Not authenticated" } },
      },
    },
    "/admin/blog/notifications": {
      get: {
        summary: "Pending newsletter queue (admin)",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: {
            description: "Pending newsletter posts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    pending: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string" },
                          slug: { type: "string" },
                          newsletterRequested: { type: "boolean" },
                          newsletterStatus: { type: "string" },
                          tags: { type: "array", items: { type: "string" } },
                          createdAt: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/admin/blog/{id}/notify": {
      post: {
        summary: "Mark a pending newsletter as sent",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Updated" },
          400: { description: "Invalid state" },
          401: { description: "Not authenticated" },
          404: { description: "Not found" },
        },
      },
    },
    "/metrics": {
      get: {
        summary: "Metrics dashboard (admin)",
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          200: {
            description: "Metrics snapshot",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    requestsTotal: { type: "integer" },
                    errorTotal: { type: "integer" },
                    exportCounts: {
                      type: "object",
                      properties: {
                        users: { type: "integer" },
                        audit: { type: "integer" },
                      },
                    },
                    lastExportDurationMs: { type: "number" },
                    lastRequestDurationMs: { type: "number" },
                    routes: {
                      type: "object",
                      additionalProperties: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
  },
};
