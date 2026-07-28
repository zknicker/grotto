/** Fresh-schema task tables, inserted after hosted Chats and before durable events. */
export const taskSchemaStatements = [
    `CREATE TABLE task_labels (
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        id text NOT NULL,
        name text NOT NULL,
        color text NOT NULL CONSTRAINT task_labels_color
            CHECK (color IN ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'gray')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, id)
    );`,
    `CREATE UNIQUE INDEX task_labels_server_name_key
        ON task_labels (server_id, lower(name));`,
    `CREATE TABLE message_tasks (
        server_id text NOT NULL,
        message_id text NOT NULL,
        chat_id text NOT NULL,
        number integer NOT NULL CONSTRAINT message_tasks_positive_number CHECK (number > 0),
        status text NOT NULL DEFAULT 'todo' CONSTRAINT message_tasks_status
            CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'closed')),
        assignee_user_id text,
        assignee_agent_id text,
        claimed_at timestamptz,
        priority text NOT NULL DEFAULT 'none' CONSTRAINT message_tasks_priority
            CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
        origin text NOT NULL CONSTRAINT message_tasks_origin
            CHECK (origin IN ('composed', 'converted')),
        created_by_user_id text,
        created_by_agent_id text,
        version integer NOT NULL DEFAULT 1
            CONSTRAINT message_tasks_positive_version CHECK (version > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, message_id),
        CONSTRAINT message_tasks_chat_number_key UNIQUE (server_id, chat_id, number),
        CONSTRAINT message_tasks_creator_shape
            CHECK (num_nonnulls(created_by_user_id, created_by_agent_id) = 1),
        CONSTRAINT message_tasks_assignee_shape
            CHECK (num_nonnulls(assignee_user_id, assignee_agent_id) <= 1),
        CONSTRAINT message_tasks_claim_shape
            CHECK (claimed_at IS NULL OR num_nonnulls(assignee_user_id, assignee_agent_id) = 1),
        CONSTRAINT message_tasks_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT message_tasks_message_fk
            FOREIGN KEY (server_id, chat_id, message_id)
            REFERENCES chat_messages (server_id, chat_id, id) ON DELETE CASCADE,
        CONSTRAINT message_tasks_creator_membership_fk
            FOREIGN KEY (server_id, created_by_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT message_tasks_assignee_membership_fk
            FOREIGN KEY (server_id, assignee_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT message_tasks_creator_agent_fk
            FOREIGN KEY (server_id, created_by_agent_id)
            REFERENCES agents (server_id, id),
        CONSTRAINT message_tasks_assignee_agent_fk
            FOREIGN KEY (server_id, assignee_agent_id)
            REFERENCES agents (server_id, id)
    );`,
    `CREATE INDEX message_tasks_chat_status_idx
        ON message_tasks (server_id, chat_id, status);`,
    `CREATE TABLE message_task_labels (
        server_id text NOT NULL,
        message_id text NOT NULL,
        label_id text NOT NULL,
        PRIMARY KEY (server_id, message_id, label_id),
        CONSTRAINT message_task_labels_task_fk
            FOREIGN KEY (server_id, message_id)
            REFERENCES message_tasks (server_id, message_id) ON DELETE CASCADE,
        CONSTRAINT message_task_labels_label_fk
            FOREIGN KEY (server_id, label_id)
            REFERENCES task_labels (server_id, id) ON DELETE CASCADE
    );`,
];
