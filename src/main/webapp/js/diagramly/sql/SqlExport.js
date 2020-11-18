const { Provider } = require("electron-updater");

function SqlExport(editorUi){
    var tables = [];
    var primayKeys = [];
    var foreignKeys = [];

    var tableCells = [];
    var edgeCells = [];
    
    function TableModel() {
        this.Name = null;
        this.Properties = []
    }

    
    function PropertyModel() {
        this.Name = null;
        this.TableName = null;
        this.ForeignKey = [];
        this.PrimaryKey = null;
        this.IsPrimaryKey = false;
        this.IsForeignKey = false;
        this.NameWithType = null;
    }

    function ForeignKeyModel() {
        this.ForeignKeyPropertyName = null;
        this.ReferencesPropertyName = null

        this.ForeignKeyTableName = null;
        this.ReferencesTableName = null;

        this.ConstraintName = null;

        this.IsDestination = false;
    }

    function PrimaryKeyModel() {
        this.PrimaryKeyName = null;
        this.PrimaryKeyTableName = null;
    }

    function scanChildren(cell) {
        const style = cell.getStyle();
        if(style != null && style.indexOf('PhysicalTable') != -1){
            tableCells.push(cell);
            return;
        }
        
        if(style != null && style.indexOf('PhysicalEdge') != -1){
            edgeCells.push(cell);
        }

        if(cell.children == null || cell.children.length === 0){
            return;
        }

        cell.children.forEach(cell => scanChildren(cell));
    }

    function getTables(graph){
        var layers = graph.model.getChildCells(graph.model.root);
        if(layers.length !== 1){
            return;
        }

        scanChildren(layers[0]);

        tableCells.forEach(element => {
            const table = new TableModel;
            const tableName = element.value;
            table.Name = tableName;
            const style = element.getStyle();
            if(style != null){
                var pkName = getPropFromStyle('PKConstraintName', style);
            }

            element.children.forEach(propRow => {
                 const field = propRow; 
                 const keys = field.children?.[0];               
                 const fieldName = field.value;
                 const firstSpaceIndex = fieldName.indexOf(" ");
                 const shortFieldName = fieldName.substring(0, firstSpaceIndex);
                 
                 const prop = new PropertyModel;
                 
                 prop.NameWithType = fieldName; 
                 prop.Name = shortFieldName;
                 prop.TableName = tableName;

                 table.Properties.push(prop);

                 const keyNames = keys != null ? keys.value.split("|") : [];

                 keyNames.forEach(keyName => {
                     if(keyName.includes("PK")){
                         const pk = new PrimaryKeyModel;                         
                         pk.PrimaryKeyName = pkName || `PK_${shortFieldName}`;
                         pk.PrimaryKeyTableName = tableName
                         primayKeys.push(pk);
                         prop.IsPrimaryKey = true;
                         prop.PrimaryKey = pk;
                     }

                     if(keyName.includes("FK")){
                        const fk = new ForeignKeyModel;
                        fk.ForeignKeyPropertyName = `${shortFieldName}`;
                        fk.ForeignKeyTableName = tableName;
                        foreignKeys.push(fk);
                        prop.IsForeignKey = true;
                        prop.ForeignKey.push(fk);
                     }
                 })                 
                 
            }); 
            tables.push(table);
        });

        assignForeignKeys();

    }

    function getPropFromStyle(propName, style){
        const propKey=`${propName}=`;
        const indexOfProp = style.indexOf(propKey);
        const propSubstr = indexOfProp !== -1 ? style.substring(indexOfProp) : "";
        const firsSemicolonIndex = propSubstr.indexOf(';');
        return firsSemicolonIndex !== -1 ? propSubstr.substring(0, firsSemicolonIndex).replace(propKey,'') : propSubstr;
    }

    function assignForeignKeys() {
        edgeCells.forEach(cell => {
            const style = cell.getStyle();
            if(style == null){
                return;
            }
            const fkName = getPropFromStyle('FKName', style);
            const fkTableName = getPropFromStyle('FKTableName', style);
            const fKRefTableName = getPropFromStyle('FKRefTableName', style);
            const fkPropName = getPropFromStyle('FKPropName', style);
            const fKRefPropName = getPropFromStyle('FKRefPropName', style);
            
            const fk = foreignKeys.find(key => key.ForeignKeyPropertyName === fkPropName && key.ForeignKeyTableName === fkTableName);
            if(fk != null){
                fk.ConstraintName = fkName;
                fk.ReferencesPropertyName = fKRefPropName;
                fk.ReferencesTableName = fKRefTableName;
            }

        });
    }

    function createTable(table){
        return `CREATE TABLE ${table.Name} (\n`;
    }

    function primaryKey(table){
        const constraintName = table.Properties.find(prop => prop.IsPrimaryKey)?.PrimaryKey?.PrimaryKeyName || `PK_${TableName}`;
        return `CONSTRAINT ${constraintName} PRIMARY KEY (${table.Properties.filter(prop => prop.IsPrimaryKey).map(prop => prop.Name).join(', ')})`        
    }
    
    function foreignKey(fks){
        return (fks || []).filter(fk => fk != null)
        .map(fk => `ALTER TABLE ${fk.ForeignKeyTableName} ADD CONSTRAINT ${fk.ConstraintName} FOREIGN KEY (${fk.ForeignKeyPropertyName}) REFERENCES ${fk.ReferencesTableName}(${fk.ReferencesPropertyName});`)
        .join('\n');        
    }

    function generateTable(table){
        let ddlScript = createTable(table);
        let separator  = `,\n  `
            
        ddlScript += `  ${table.Properties.map(prop => prop.NameWithType).join(separator)}`;
        
        if(table.Properties.some(prop => prop.IsPrimaryKey)){
            ddlScript += `${separator}${primaryKey(table)}`;
        }

        ddlScript += `\n);\n\n`;

        const fkProps = table.Properties.filter(prop => prop.IsForeignKey);
        ddlScript += fkProps.map(prop => foreignKey(prop.ForeignKey)).join('\n\n');

        ddlScript += `\n\n`;

        return ddlScript;       
           
    }

    this.exportCurrentDiagrams = function() {
        try {
            
            if (editorUi.spinner.spin(document.body, mxResources.get('exporting'))){
                
                getTables(editorUi.editor.graph);
                console.log(tables);
                console.log(primayKeys);
                console.log(foreignKeys);
                const sqlText = tables.map(generateTable).join("\n");
                console.log(sqlText);
                editorUi.spinner.stop();
                var basename = editorUi.getBaseFilename();
                editorUi.saveData(basename + ".sql", 'sql', sqlText,
                    'text/plain;charset=utf-8', false);
                
                
            }
            return true;
            
        } catch (e) {
            console.log(e);
			editorUi.spinner.stop();
			return false;
        }
        
    };
}