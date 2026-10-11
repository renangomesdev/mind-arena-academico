package com.mindarena.model;
import jakarta.persistence.*;
@Entity
public class ResourceQuota {
    @Id private String id;
    public ResourceQuota() {}
    public ResourceQuota(String id) { this.id = id; }
    public String getId() { return id; }
}

