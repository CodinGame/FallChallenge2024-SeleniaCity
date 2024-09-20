package com.codingame.view.history;

import java.util.Objects;

public class FromTo {
    int fromId;
    int toId;

    public FromTo(PodTransport p) {
        this.fromId = p.fromId;
        this.toId = p.toId;
    }

    @Override
    public int hashCode() {
        return Objects.hash(fromId, toId);
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null) return false;
        if (getClass() != obj.getClass()) return false;
        FromTo other = (FromTo) obj;
        return fromId == other.fromId && toId == other.toId;
    }

}
